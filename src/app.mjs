import sqlite3  from 'sqlite3';
import sqlcipher from '@journeyapps/sqlcipher';
import fs from 'fs';
import pkg from 'jamp3';
const {ID3v2} = pkg;


function mergeMixxxHotcuesintoMixxxDb(src, dst) {
	var source = new sqlite3.Database(src);
	var target = new sqlite3.Database(dst);

	target.all("DELETE FROM cues");

	let cueTids = [];
	source.serialize(() => {
		var cueStmt = source.prepare("SELECT DISTINCT track_id FROM cues ORDER BY track_id ASC");
		cueStmt.each([], (err, row) => {
			cueTids.push(row.track_id);
		}, () => {
			cueStmt.finalize();
			console.log(cueTids);

			var libStmt = source.prepare("SELECT * FROM library WHERE id = ?");
			for(var i = 0; i  < cueTids.length; i++) {
				libStmt.get([cueTids[i]], (err, trackSrc) => {
					
					target.get("SELECT * FROM library WHERE title = ? AND artist = ?", [trackSrc.title, trackSrc.artist], function(err, trackDst) {
						if (trackDst !== undefined) { 
							console.log("Merging " + trackDst.artist + " - " + trackDst.title);
							source.each("SELECT * FROM cues WHERE track_id = ?", [trackSrc.id], function(err, cue) {	
								target.run("INSERT INTO cues VALUES(?,?,?,?,?,?,?,?)", [cue.id, trackDst.id, cue.type, cue.position, cue.length, cue.hotcue, cue.label, cue.color]);
								target.run("UPDATE library SET comment = ? WHERE id = ?", ["Impoerted", trackDst.id]);
							});
						}
					});

				});			
			}
			libStmt.finalize();

		});
	});

	//source.close();
	target.close();
}

const toArrayBuffer = buffer => {
    const bufferLength = buffer.length;
    const uint8Array = new Uint8Array(new ArrayBuffer(bufferLength));
    for (let i = 0; i < bufferLength; ++i) { uint8Array[i] = buffer[i]; }
    return uint8Array.buffer;
};

function mergeMixxxHotcuesIntoRekordboxDb(src, dst) {
	var source = new sqlite3.Database(src);
	var target = new sqlcipher.Database(dst);
	
	target.run("PRAGMA cipher_compatibility = 4");
	target.run("PRAGMA key = '402fd482c38817c35ffa8ffb8c7d93143b749e7d315df7a81732a1ff43608497'");
	target.serialize(() => target.run("DELETE FROM djmdCue"));

	let cueTids = [];
	source.serialize(() => {
		var cueStmt = source.prepare("SELECT DISTINCT track_id FROM cues ORDER BY track_id ASC");
		cueStmt.each([], (err, row) => {
			cueTids.push(row.track_id);
		}, () => {
			cueStmt.finalize();
			console.log(cueTids);

			var locStmt = source.prepare("SELECT * FROM track_locations WHERE id = ?");
			for(var id of cueTids) {		
				locStmt.each([id], function(err, trackLoc) {
					var row = target.get("SELECT * FROM djmdContent WHERE FolderPath = ?", [trackLoc.location], function(err, djmd) {
						source.all("SELECT * FROM cues WHERE track_id = ?", [trackLoc.id], function(err, cues) {

							console.log("Merging " + djmd.FileNameL);	
							var buffer = fs.readFileSync(trackLoc.location);						
							buffer = new DataView(toArrayBuffer(buffer));
							var tags = mp3Parser.readTags(buffer);
							var firstFrame = undefined;
							for (var sect of tags) {
								if (sect._section.type === 'frame') {
									firstFrame = sect;
									break;
								}						
							}
							
							for(var cue of cues) {
								if (cue.hotcue === -1)
									continue; // Skip start cues

								/* hex for 'mixxxdjexp' */
								var cueUUID = "6d697878-7864-6a65-7870-" + cue.id.toString(10);
								while(cueUUID.length < 36)
									cueUUID = cueUUID + "0";

								// Adjust hotcue ID because
								// holy shit Rekordbox
								var hotcueNum = cue.hotcue + 1;
								if (hotcueNum >= 4)
									hotcueNum += 1;

								var params =  [
									/*id*/ cue.id,
									/*contentId*/ djmd.ID,
									/*InMsec*/ (cue.position + 44.1 * 44.1) / 88.2,
									/*InFrame*/ 0,
									/*InMpegFrame*/ 0,
									/*InMpegAbs*/ 0,
									/*OutMsec*/ -1,
									/*OutFrame*/ 0,
									/*OutMpegFrame*/ 0,
									/*OutMpegAbs*/ 0,
									/*Kind*/ hotcueNum,
									/*Color*/ cue.color,
									/*ColorTableIndex*/ 0,
									/*ActiveLoop*/ 0,
							//		/*Comment*/ cue.label === '' ? "Hotcue " + (cue.hotcue+1).toString(10) : cue.label,
									/*Comment*/ cue.label,
									/*BeatLoopSize*/ 0, 
									/*CueMicrosec*/ 0, 
									/*InPointSeekInfo*/ null,
									/*OutPointSeekInfo*/ null,
									/*ContentUUID*/ djmd.UUID,
									/*UUID*/ cueUUID,
									/*rb_data_status*/ 0,
									/*rb_local_data_status*/ 0,
									/*rb_local_deleted*/ 0, 
									/*rb_local_synched*/ 0, 
									/*usn*/ null,
									/*rb_local_usn*/ null, 
									/*created_at*/ new Date().toISOString(),
									/*updated_at*/ new Date().toISOString()
								];
								target.run("INSERT INTO djmdCue VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", params);							
							}
						});
					});
				});
			}
			locStmt.finalize();

		});
	});

	//source.close();
	//target.close();

}


function readSeratoMarkers2(buffer) {
	var tags = [];
	var idx = 2;

	while (idx < buffer.length) {
		var title = "";
		while (buffer[idx] !== 0) {
			title += String.fromCharCode(buffer[idx++]);
		}
		idx += 5;
		if(title === 'COLOR') {
			tags.push({tag: title, value: buffer.readUInt32LE(idx)});
			idx+=4;
		}
		else if(title === 'CUE') {
			var index = buffer.readUInt8(idx+1);
			var offsetMs = buffer.readInt32LE(idx+2);
			var color = buffer.readUInt32LE(idx+6) && 0x00ffffff;
			var n = "";
			var i = 0;
			var c = 0;
			while ((c = buffer.readUInt8(idx+0xc)) !== 0) 
				n += String.fromCharCode(c); 
			tags.push({tag: title, index: index, offsetMs: offsetMs, color: color, name: n});
			idx+=13;
		}
		else if(title === 'BPMLOCK') {
			tags.push({tag: title, value: buffer.readUInt16LE(idx) !== 0});
			idx+=2;
		}
	}
	return tags;
}


function importCuepointsFromSeratoTags(dst) {
	var target = new sqlcipher.Database(dst);
	
	target.run("PRAGMA cipher_compatibility = 4");
	target.run("PRAGMA key = '402fd482c38817c35ffa8ffb8c7d93143b749e7d315df7a81732a1ff43608497'");
	target.serialize(() => target.run("DELETE FROM djmdCue"));

	
	target.all("SELECT * FROM djmdContent", function(err, djmd) {
		for(var track of djmd) {	
			const idv2 = new ID3v2();	
			idv2.read(track.FolderPath).then(tags => {
				for(var i = 0; i < tags.frames.length; i++) {
					var tag = tags.frames[i];
					if (tag.id !== 'GEOB')
						continue;
					if (tag.value.contentDescription !== 'Serato Markers2')
						continue;
					
					var tmp = Buffer.from(tag.value.bin.toString(), 'base64');
					tmp = Buffer.from(tmp.toString('ascii'));
					


					var seratoTags = readSeratoMarkers2(tmp);
					for(var j = 0; j < seratoTags.length; j++) {
						var st = seratoTags[j];
						console.log(st);
						if (st.tag !== "CUE")
							continue;
							
						var id = Math.floor(Math.random() * 1000000);

						/* hex for 'mixxxdjexp' */
						var cueUUID = "73657261-746f-646a-0000-" + id.toString(10);
						while(cueUUID.length < 36)
							cueUUID = cueUUID + "0";

						// Adjust hotcue ID because
						// holy shit Rekordbox
						var hotcueNum = st.index + 1;
						if (hotcueNum >= 4)
							hotcueNum += 1;

						var params =  [
							/*id*/ id,
							/*contentId*/ track.ID,
							/*InMsec*/ Math.floor(st.offsetMs / 9789.098),
							/*InFrame*/ 0,
							/*InMpegFrame*/ 0,
							/*InMpegAbs*/ 0,
							/*OutMsec*/ -1,
							/*OutFrame*/ 0,
							/*OutMpegFrame*/ 0,
							/*OutMpegAbs*/ 0,
							/*Kind*/ hotcueNum,
							/*Color*/ st.color,
							/*ColorTableIndex*/ 0,
							/*ActiveLoop*/ 0,
					//		/*Comment*/ cue.label === '' ? "Hotcue " + (cue.hotcue+1).toString(10) : cue.label,
							/*Comment*/ st.name,
							/*BeatLoopSize*/ 0, 
							/*CueMicrosec*/ 0, 
							/*InPointSeekInfo*/ null,
							/*OutPointSeekInfo*/ null,
							/*ContentUUID*/ djmd.UUID,
							/*UUID*/ cueUUID,
							/*rb_data_status*/ 0,
							/*rb_local_data_status*/ 0,
							/*rb_local_deleted*/ 0, 
							/*rb_local_synched*/ 0, 
							/*usn*/ null,
							/*rb_local_usn*/ null, 
							/*created_at*/ new Date().toISOString(),
							/*updated_at*/ new Date().toISOString()
						];
						target.run("INSERT INTO djmdCue VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", params);	
					}
				}
			});
		}
	});
}


//mergeMixxxHotcuesIntoRekordboxDb('mixxxdb.sqlite', 'M:\\PIONEER\\Master\\master.db');
importCuepointsFromSeratoTags('M:\\PIONEER\\Master\\master.db');