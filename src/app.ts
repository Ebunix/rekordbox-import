import { MixxxAdapter } from './adapters/mixxx';
import { RekordboxAdapter } from './adapters/rekordbox';
import { remapPath } from './tools';

const mixxxAdapter = new MixxxAdapter();
const rekordboxAdapter = new RekordboxAdapter();

new Promise<void>(async (resolve, _reject) => {
    await mixxxAdapter.open('mixxxdb.source');
    await rekordboxAdapter.open('newmaster.db');
    await rekordboxAdapter.initialize();

    const tracks = await mixxxAdapter.getTracks();
    const remappedTracks = tracks.map(t => ({
        ...t,
        sourcePath: remapPath(t.sourcePath, 'Z:/Library', 'D:/@home/ebu/Music')
    }));
    const playlists = await mixxxAdapter.getPlaylists(remappedTracks);

    for (const t of remappedTracks) {
        await rekordboxAdapter.insertTrack(t);
    }
    for (const p of playlists) {
        await rekordboxAdapter.insertPlaylist(p);
    }

    resolve();
}).then(() => {
    rekordboxAdapter.close();
    mixxxAdapter.close();
	console.log(`Closed`);
});


