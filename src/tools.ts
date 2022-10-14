import * as sqlite3 from 'sqlite3';
import * as sqlcipher from '@journeyapps/sqlcipher';
import { Track } from './track';
import * as fs from 'fs';
import * as path from 'path';

type SqliteDb = sqlite3.Database | sqlcipher.Database;
type SqliteStmt = sqlite3.Statement | sqlcipher.Statement;

export async function allAsync<T>(stmt: SqliteStmt, params?: any) {
	return new Promise<T[] | undefined>((resolve, reject) => {
		stmt.all(params, (err, rows) => {
			if (err) {
				reject(err);
				return;
			}
			stmt.finalize(err => {
				if (err) {
					reject(err);
					return;
				}
				resolve(rows as T[]);
			});
		});
	});
}
export async function runAsync(stmt: SqliteStmt, params?: any) {
	return new Promise<void>((resolve, reject) => {
		stmt.run(params, (err) => {
			if (err) {
				reject(err);
				return;
			}
			stmt.finalize(err => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	});
}

export function buildInsertStatement(table: string, obj: any) {
	const keys = Object.keys(obj);
	return `INSERT INTO ${table} (${keys.map(k => k.slice(1)).join(',')}) VALUES (${keys.join(',')})`;
}

export async function allDbAsync<T>(db: SqliteDb, code: string, params?: any) {
	return new Promise<T[] | undefined>((resolve, reject) => {
		db.all(code, params, (err, rows) => {
			if (err) {
				reject(err);
			}
			else {
				resolve(rows as T[]);
			}
		});
	});
}
export async function execDbAsync(db: SqliteDb, code: string) {
	return new Promise<void>((resolve, reject) => {
		db.exec(code, (err) => {
			if (err) {
				reject(err);
			}
			else {
				resolve();
			}
		});
	});
}
export async function runDbAsync(db: SqliteDb, code: string, params?: any) {
	return new Promise<void>((resolve, reject) => {
		db.run(code, params, (err) => {
			if (err) {
				reject(err);
			}
			else {
				resolve();
			}
		});
	});
}
export async function getDbAsync<T>(db: SqliteDb, code: string, params?: any) {
	return new Promise<T | undefined>((resolve, reject) => {
		db.get(code, params, (err, row) => {
			if (err) {
				reject(err);
			}
			else {
				resolve(row as T);
			}
		});
	});
}

export function remapPath(path: string | undefined, srcPrefix: string, dstPrefix: string) {
	if (path?.startsWith(srcPrefix)) {
		return dstPrefix + path.slice(srcPrefix.length)
	}
	return path;
}

export async function loadSchema(database: SqliteDb, name: string) {
	console.log(`Initializing new ${name} schema`);
	const schemaSrc = path.resolve(path.join('schema', name + '.sql'));
	const schemaSql = fs.readFileSync(schemaSrc).toString('utf8').split(';');

	for (const stmt of schemaSql) {
		await execDbAsync(database, stmt);
	}
	console.log(`Initializing ${name} done`);
}

export async function openDatabaseSqlite3(path: string, cb?: (db: sqlite3.Database) => void) {
	return new Promise<sqlite3.Database>((resolve, reject) => {
		const result = new sqlite3.Database(path, error => {
			if (error) {
				reject(error);
				return;
			}
			cb?.(result);
			resolve(result);
		})
	});
}

export async function openDatabaseSqlcipher(path: string, cb?: (db: sqlcipher.Database) => void) {
	return new Promise<sqlcipher.Database>((resolve, reject) => {
		const result = new sqlcipher.Database(path, error => {
			if (error) {
				reject(error);
				return;
			}
			cb?.(result);
			resolve(result);
		})
	});
}

export function createUpdateDate() {
	const now = new Date();
	return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}.000 +00:00`;
}
