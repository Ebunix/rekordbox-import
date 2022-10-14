import { Stats } from "fs";

export enum CueType {
    Invalid = 0,
    HotCue = 1,
    MainCue = 2,
    Loop = 4,
    Jump = 5,
    Intro = 6,
    Outro = 7,
    AudibleSound = 8,
}

export interface Cue {
	id: string;
	
	color: number;
	timecode: number;
	length: number;
	type: CueType;
	number: number;
}

export interface Track {
	id: string;

	title?: string;
	album?: string;
	artist?: string;

	genre?: string;
	key?: string;

	sourcePath?: string;
	samplerate?: number;
	duration?: number;
	bpm?: number;
	hotcues?: Cue[];

	fileInfo?: Stats;
}

export interface Playlist {
	id: string;
	name: string;
	created: Date;
	modified: Date;

	tracks: Track[]
}