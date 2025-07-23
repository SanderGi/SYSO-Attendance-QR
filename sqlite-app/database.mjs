const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

// init sqlite db
const dbFile = process.env.DB_FILE || "./.data/local.db";
const exists = fs.existsSync(dbFile);
if (!exists) {
  throw new Error("no database file found :(");
}
export const db = new sqlite3.Database(dbFile);

// ============================ ASYNC DATABASE FUNCTIONS ============================
/**
 * Gets the first result of the sql query on the database.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @returns a Promise of an object representing the first result of the sql query.
 */
export function asyncGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) {
        console.log("sql error: " + sql);
        reject(err);
      } else resolve(result);
    });
  });
}

/**
 * Gets all the results of the sql query on the database.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @returns a Promise of an array representing all the results of the sql query.
 */
export function asyncAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, result) => {
      if (err) {
        console.log("sql error: " + sql);
        reject(err);
      } else resolve(result);
    });
  });
}

/**
 * Runs a sql query on the database.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @returns Promise<void>
 */
export function asyncRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err, rows) => {
      if (err) {
        console.log(err);
        console.log("SQL: " + sql);
        console.log(`${params}`);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Runs a sql query on the database and gets the id of the last inserted row.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @requires sql should be an INSERT statement
 * @returns a Promise of the id of the last inserted row (if the sql query was an INSERT statement!).
 */
export function asyncRunWithID(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.log("sql error: " + sql);
        reject(err);
      } else resolve(this.lastID);
    });
  });
}

/**
 * Runs a sql query on the database and gets the number of rows changed.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @requires sql should be an INSERT, UPDATE, or DELETE statement
 * @returns a Promise of the number of rows changed by the sql query.
 */
export function asyncRunWithChanges(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.log("sql error: " + sql);
        reject(err);
      } else resolve(this.changes);
    });
  });
}
