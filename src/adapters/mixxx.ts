import { CueType, Playlist, Track } from '../track';
import { Adapter } from './adapter';
import * as sqlite3 from 'sqlite3';
import { allAsync, allDbAsync, getDbAsync, loadSchema, openDatabaseSqlite3 } from '../tools';
import path from 'path';
import { statSync } from 'fs';

export class MixxxAdapter implements Adapter {
	name = 'mixxx';

	private db?: sqlite3.Database;

	async open(db: string) {
		console.log('Opening Mixxx database', db);
		this.db = await openDatabaseSqlite3(db);
	}
	close() {
		this.db?.close();
	}
	save() {}
	async initialize() {
		if (!this.db) {
			throw new Error('Database not open');
		}
		return loadSchema(this.db, this.name);
	}
	async getTracks() {
		if (!this.db) {
			throw new Error('Database not open');
		}

		const tracks = await allDbAsync<{
			id: number, artist?: string, title?: string, album?: string, genre?: string, key?: string, sourcePath: string,
			samplerate: number, duration: number, bpm: number
		}>(this.db, `
			SELECT 
			library.id, artist, title, album, genre, key, samplerate, duration, bpm, track_locations.location as sourcePath
			FROM library
			JOIN track_locations
			ON library.location = track_locations.id`);
		if (!tracks) {
			return [];
		}

		const result: Track[] = [];

		for (const row of tracks) {
			const track: Track = {
				...row,
				id: row.id.toString(),
				hotcues: []
			};

			const cues = await allAsync<{
				id: number, track_id: number, type: CueType, position: number, hotcue: number, label: string, color: number, length: number
			}>(this.db.prepare('SELECT id, track_id, type, position, hotcue, label, color, length FROM cues WHERE track_id = $track_id'), { $track_id: row.id });

			if (cues) {
				for (const cue of cues) {
					track.hotcues!.push({
						id: cue.id.toString(),
						color: cue.color,
						timecode: cue.position / ((track.samplerate ?? 44.1) * 2) * 1000,
						type: cue.type,
						length: cue.length,
						number: cue.hotcue
					});
				}
			}

			track.fileInfo = statSync(track.sourcePath ?? '', { throwIfNoEntry: false });

			result.push(track);
		}

		return result;
	}
	async insertTrack(track: Track): Promise<void> {
		throw new Error('Method not implemented.');
	}
	async getPlaylists(tracks: Track[]) {
		if (!this.db) {
			throw new Error('Database not open');
		}

		const allPlaylists = await allDbAsync<{
			id: number, name: string | null, hidden: number | null, date_created: Date | null, date_modified: Date | null
		}>(this.db, 'SELECT id, name, hidden, date_created, date_modified FROM Playlists WHERE hidden = 0');
		const allCrates = await allDbAsync<{
			id: number, name: string | null
		}>(this.db, 'SELECT id, name FROM crates');
		
		const mapPlaylists = new Map<number, Playlist>();
		const mapCrates = new Map<number, Playlist>();
		let counter = 1;
		let playlistMaxId = 0;

		for (const pl of allPlaylists ?? []) {
			const name = pl.name ?? 'Untitled Playlist';
			const playlist: Playlist = {
				id: pl.id.toString(),
				created: pl.date_created ?? new Date(),
				modified: pl.date_modified ?? new Date(),
				name,
				tracks: []
			};
			mapPlaylists.set(pl.id, playlist);
			playlistMaxId = Math.max(pl.id, playlistMaxId);
		}

		for (const pl of allCrates ?? []) {
			const name = pl.name ?? 'Untitled Crate';
			const playlist: Playlist = {
				id: (playlistMaxId + pl.id).toString(),
				created: new Date(),
				modified: new Date(),
				name: '[Crate] ' + name,
				tracks: []
			};
			mapPlaylists.set(playlistMaxId + pl.id, playlist);
		}

		const allPlaylistLinks = await allDbAsync<{
			playlist_id: number, track_id: number
		}>(this.db, 'SELECT Playlists.id as playlist_id, PlaylistTracks.track_id FROM Playlists JOIN PlaylistTracks ON Playlists.id = PlaylistTracks.playlist_id');
		for (const link of allPlaylistLinks ?? []) {
			const track = tracks.find(t => t.id === link.track_id.toString());
			if (!track) {
				console.log(`Could not find track ${link.track_id} while building playlist ${link.playlist_id}`);
				continue;
			}
			mapPlaylists.get(link.playlist_id)?.tracks.push(track);
		}

		const allCrateLinks = await allDbAsync<{
			crate_id: number, track_id: number
		}>(this.db, 'SELECT crates.id as crate_id, crate_tracks.track_id FROM crates JOIN crate_tracks ON crates.id = crate_tracks.crate_id');
		for (const link of allCrateLinks ?? []) {
			const track = tracks.find(t => t.id === link.track_id.toString());
			if (!track) {
				console.log(`Could not find track ${link.track_id} while building crate ${link.crate_id}`);
				continue;
			}
			mapPlaylists.get(playlistMaxId + link.crate_id)?.tracks.push(track);
		}

		const final: Playlist[] = [];
		for (const pl of mapPlaylists.values()) {
			final.push(pl);
		}
		return final;
	}
}