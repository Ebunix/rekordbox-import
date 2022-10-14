import { Track } from '../track';

export interface Adapter {
	name: string;
	open(db: string): void;
	close(): void;
	save(): void;
	initialize(): void;
	getTracks(): Promise<Track[]>;
	insertTrack(track: Track): Promise<void>;
}
