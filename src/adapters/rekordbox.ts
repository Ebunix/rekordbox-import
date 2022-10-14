import { Cue, CueType, Playlist, Track } from '../track';
import { Adapter } from './adapter';

import * as sqlcipher from '@journeyapps/sqlcipher';
import { buildInsertStatement, createUpdateDate, execDbAsync, getDbAsync, loadSchema, openDatabaseSqlcipher, runDbAsync } from '../tools';
import { randomUUID } from 'crypto';
import path from 'path';
import { stat, statSync } from 'fs';

const REKORDBOX_ENCRYPTION_KEY = '402fd482c38817c35ffa8ffb8c7d93143b749e7d315df7a81732a1ff43608497';

interface CreateUpdate {
	$created_at: string;
	$updated_at: string;
}
interface RekordboxTrack extends CreateUpdate {
	$ID?: string,
	$FolderPath?: string;
	$FileNameL?: string;
	$FileNameS?: string;
	$Title?: string;
	$ArtistID?: string;
	$AlbumID?: string;
	$GenreID?: string;
	$BPM?: number;
	$Length?: number;
	$TrackNo?: number;
	$BitRate?: number;
	$BitDepth?: number;
	$Commnt?: string;
	$FileType?: number;
	$Rating?: number;
	$ReleaseYear?: number;
	$RemixerID?: string;
	$LabelID?: string;
	$OrgArtistID?: string;
	$KeyID?: string;
	$StockDate?: string;
	$ColorID?: string;
	$DJPlayCount?: number;
	$ImagePath?: string;
	$MasterDBID?: string;
	$MasterSongID?: string;
	$AnalysisDataPath?: string;
	$SearchStr?: string;
	$FileSize?: number;
	$DiscNo?: number;
	$ComposerID?: string;
	$Subtitle?: string;
	$SampleRate?: number;
	$DisableQuantize?: number;
	$Analysed?: number;
	$ReleaseDate?: string;
	$DateCreated?: string;
	$ContentLink?: number;
	$Tag?: string;
	$ModifiedByRBM?: string;
	$HotCueAutoLoad?: string;
	$DeliveryControl?: string;
	$DeliveryComment?: string;
	$CueUpdated?: string;
	$AnalysisUpdated?: string;
	$TrackInfoUpdated?: string;
	$Lyricist?: string;
	$ISRC?: string;
	$SamplerTrackInfo?: number;
	$SamplerPlayOffset?: number;
	$SamplerGain?: number;
	$VideoAssociate?: string;
	$LyricStatus?: number;
	$ServiceID?: number;
	$OrgFolderPath?: string;
	$Reserved1?: string;
	$Reserved2?: string;
	$Reserved3?: string;
	$Reserved4?: string;
	$ExtInfo?: string;
	$rb_file_id?: string;
	$DeviceID?: string;
	$rb_LocalFolderPath?: string;
	$SrcID?: string;
	$SrcTitle?: string;
	$SrcArtistName?: string;
	$SrcAlbumName?: string;
	$SrcLength?: number;
	$UUID?: string;
}
interface RekordboxArtist extends CreateUpdate {
	$ID: string;
	$Name?: string;
	$SearchStr?: string;
	$UUID?: string;
}
interface RekordboxAlbum extends CreateUpdate {
	$ID: string;
	$Name?: string;
	$SearchStr?: string;
	$UUID?: string;
	$AlbumArtistID?: string;
	$ImagePath?: string;
	$Compilation?: number;
}
interface RekordboxCue extends CreateUpdate {
	$ID: string;
	$ContentID?: string;
	$InMsec?: number;
	$InFrame?: number;
	$InMpegFrame?: number;
	$InMpegAbs?: number;
	$OutMsec?: number;
	$OutFrame?: number;
	$OutMpegFrame?: number;
	$OutMpegAbs?: number;
	$Kind?: number;
	$Color?: number;
	$ColorTableIndex?: number;
	$ActiveLoop?: number;
	$Comment?: string;
	$BeatLoopSize?: number;
	$CueMicrosec?: number;
	$InPointSeekInfo?: string;
	$OutPointSeekInfo?: string;
	$ContentUUID?: string;
	$UUID?: string;
}
interface RekordboxPlaylist extends CreateUpdate {
	$ID: string;
	$Seq?: number;
	$Name?: string;
	$ImagePath?: string;
	$Attribute?: number;
	$ParentID?: string;
	$SmartList?: string;
	$UUID?: string;
}
interface RekordboxSongPlaylist extends CreateUpdate {
	$ID: string;
	$PlaylistID?: string;
	$ContentID?: string;
	$TrackNo?: number;
	$UUID?: string;
}

export class RekordboxAdapter implements Adapter {
	name = 'rekordbox';

	private db?: sqlcipher.Database;

	async open(db: string) {
		console.log('Opening Rekordbox database', db);
		this.db = await openDatabaseSqlcipher(db, db => {
			db.run("PRAGMA cipher_compatibility = 4");
			db.run(`PRAGMA key = '${REKORDBOX_ENCRYPTION_KEY}'`);
		});
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
	async getTracks(): Promise<Track[]> {
		throw new Error('Method not implemented.');
	}

	private nextIdMap = new Map<string, number>();
	private async getNextId(table: string) {
		let value = this.nextIdMap.get(table);
		if (!value) {
			value = 0;
		}
		value += 1;
		this.nextIdMap.set(table, value);
		return value;
	}

	private async insertTrackArtist(db: sqlcipher.Database, track: Track) {
		
		const result = await getDbAsync<{ artistId: string | null }>(db, 'SELECT ID as artistId FROM djmdArtist WHERE Name = $Name', { $Name: track.artist ?? '' });
		if (result?.artistId) {
			return result.artistId;
		}

		const numberId = await this.getNextId('djmdArtist');

		const newId = (numberId + 1).toString();
		const rbArtist: RekordboxArtist = {
			$ID: newId,
			$UUID: randomUUID(),
			$Name: track.artist,
			$created_at: createUpdateDate(),
			$updated_at: createUpdateDate(),
		}
		await runDbAsync(db, buildInsertStatement('djmdArtist', rbArtist), rbArtist);

		return newId;
	}
	private async insertTrackAlbum(db: sqlcipher.Database, track: Track) {
		const result = await getDbAsync<{ albumId: string | null }>(db, 'SELECT ID as albumId FROM djmdAlbum WHERE Name = $Name', { $Name: track.album ?? '' });
		if (result?.albumId) {
			return result.albumId;
		}

		const numberId = await this.getNextId('djmdAlbum');

		const newId = (numberId + 1).toString();
		const rbAlbum: RekordboxAlbum = {
			$ID: newId,
			$UUID: randomUUID(),
			$Name: track.album,
			$created_at: createUpdateDate(),
			$updated_at: createUpdateDate(),
		}
		await runDbAsync(db, buildInsertStatement('djmdAlbum', rbAlbum), rbAlbum);

		return newId;
	}

	private async insertHotcue(contentId: string, contentUuid: string, cue: Cue) {
		if (!this.db) {
			return;
		}

		let cueKind: number;
		switch (cue.type) {
			case CueType.HotCue:
				cueKind = cue.number >= 3 ? cue.number + 2 : cue.number + 1;
				break;
			case CueType.MainCue:
				cueKind = 0;
				break;
			default:
				return;
		}
		
		const nextId = await this.getNextId('djmdCue');

		const rbCue: RekordboxCue = {
			$ID: (nextId + 1).toString(),
			$ContentID: contentId,
			$InMsec: cue.timecode,
			$InFrame: 0,
			$InMpegFrame: 0,
			$InMpegAbs: 0,
			$OutMsec: -1,
			$OutFrame: 0,
			$OutMpegFrame: 0,
			$OutMpegAbs: 0,
			$Kind: cueKind,
			$Color: -1,
			$ContentUUID: contentUuid,
			$UUID: randomUUID(),
			$created_at: createUpdateDate(),
			$updated_at: createUpdateDate(),
		};

		try {
			await runDbAsync(this.db, buildInsertStatement('djmdCue', rbCue), rbCue);
		}
		catch (ex) {}
	}

	async insertTrack(track: Track) {
		console.log(`[+] ${track.artist ?? '<unknown>'} - ${track.title ?? '<untitled>'}`);

		if (!this.db) {
			throw new Error('Database not open');
		}

		const artistId = await this.insertTrackArtist(this.db, track);
		const albumId = await this.insertTrackAlbum(this.db, track);
		const numberId = await this.getNextId('djmdContent');
		const contentId = (numberId + 1).toString();
		
		const now = new Date();
		const createTime = track.fileInfo?.ctime ?? new Date();
		const fileCreateDateStrng = `${createTime.getFullYear()}-${createTime.getMonth()}-${createTime.getDate()}`;
		const stockDateStrng = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

		(track as any).$ID = contentId;

		const rbTrack: RekordboxTrack = {
			$ID: contentId,
			$UUID: randomUUID(),
			$created_at: createUpdateDate(),
			$updated_at: createUpdateDate(),

			$FileNameL: path.basename(track.sourcePath ?? ''),
			$FolderPath: track.sourcePath ?? '',
			$FileType: 1,
			$Title: track.title,
			$ArtistID: artistId,
			$AlbumID: albumId,
			$FileSize: track.fileInfo?.size ?? 0,
			$SampleRate: track.samplerate,
			$BPM: (track.bpm ?? 0) * 100,
			$Length: Math.round(track.duration ?? 0),
			$Analysed: 0,
			$DateCreated: fileCreateDateStrng,
			$HotCueAutoLoad: 'on',
			$SamplerPlayOffset: 0,
			$SamplerGain: 0.0,
			$SamplerTrackInfo: 0,
			$VideoAssociate: '0',
			$LyricStatus: 0,
			$ServiceID: 0,
			$ExtInfo: 'null',
			$StockDate: stockDateStrng
		};

		await runDbAsync(this.db, buildInsertStatement('djmdContent', rbTrack), rbTrack);

		if (track.hotcues?.length) {
			console.log(`[+]   Adding ${track.hotcues.length} cues`);
			for (const cue of track.hotcues ?? []) {
				await this.insertHotcue(contentId, rbTrack.$UUID!, cue);
			}
		}
	}
	async insertPlaylist(playlist: Playlist) {

		console.log(`[+] Inserting playlist ${playlist.name}`);

		if (!this.db) {
			throw new Error('Database not open');
		}

		const numberId = await this.getNextId('djmdPlaylist');
		const playlistContentID = (numberId + 1).toString();

		const rbPlaylist: RekordboxPlaylist = {
			$ID: playlistContentID,
			$UUID: randomUUID(),
			$created_at: createUpdateDate(),
			$updated_at: createUpdateDate(),

			$Attribute: 0,
			$Seq: 0,
			$ParentID: 'root',
			$Name: playlist.name
		};

		await runDbAsync(this.db, buildInsertStatement('djmdPlaylist', rbPlaylist), rbPlaylist);

		let counter = 1;
		for (const track of playlist.tracks) {
			const rbSongPl: RekordboxSongPlaylist = {
				$ID: randomUUID(),
				$UUID: randomUUID(),
				$created_at: createUpdateDate(),
				$updated_at: createUpdateDate(),

				$PlaylistID: playlistContentID,
				$ContentID: (track as any).$ID,
				$TrackNo: counter++
			}
			await runDbAsync(this.db, buildInsertStatement('djmdSongPlaylist', rbSongPl), rbSongPl);
		}
	}

}