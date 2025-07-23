const {
  IsKnownPasskey,
  isStudentLoggedin,
  CanAddRegistrations,
  isAdminLoggedin,
  CanGetStudentRegistrations,
  CanGetRegistrations,
  CanGetRehearsalDates,
} = require("auth.mjs");
const { db, asyncAll, asyncRun } = require("database.mjs");

// init project
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  response.sendFile(`${__dirname}/public/index.html`);
});

app.get("/iskeyvalid", (request, response) => {
  if (!IsKnownPasskey(request)) {
    response.sendStatus(403);
  } else {
    response.sendStatus(200);
  }
});

app.get("/isstudentkeyvalid", (request, response) => {
  if (!isStudentLoggedin(request)) {
    response.sendStatus(403);
  } else {
    response.sendStatus(200);
  }
});

app.get("/addRegistration", (request, response) => {
  if (!CanAddRegistrations(request)) {
    response.sendStatus(403);
    return;
  }

  if (!process.env.DISALLOW_WRITE) {
    const guid = cleanseString(request.query.guid || "");
    if (guid == "") {
      // insert new registration
      const id = cleanseString(request.query.id || "404");
      const name = cleanseString(request.query.name || "no name");
      const date = cleanseString(request.query.date || "now");
      const status = cleanseString(request.query.status || "P");

      // todo, consider: change to upsert, overwrite previous values?
      let sql = `INSERT INTO AttendanceRegistrations (student_id, created_date, rehearsal_date, Name, guid, registration_type) VALUES (${id}, datetime('now'), date('${date}'), '${name}','${getUniqueId()}','${status}')`;
      db.run(sql, (error) => {
        if (error) {
          response.send({ message: "error!" });
          console.log(error, sql);
        } else {
          db.all(`SELECT Name from Students WHERE ID=${id}`, (err, rows) => {
            if (err) {
              response.send({ message: "error!" });
              console.log(error, sql);
            } else {
              if (rows.count > 0) {
                response.send(JSON.stringify(rows));
                console.log(JSON.stringify(rows));
              } else {
                let rows2 = [{ Name: name }];
                response.send(JSON.stringify(rows2));
                console.log(JSON.stringify(rows2));
              }
            }
          });
          db.all(
            `SELECT * from AttendanceRegistrations WHERE student_id=${id} AND rehearsal_date=date('now')`,
            (err, rows) => {
              console.log(JSON.stringify(rows));
            }
          );
        }
      });
    } else {
      db.get(
        `SELECT * from AttendanceRegistrations WHERE guid='${guid}'`,
        (err, row) => {
          if (row && row.guid == guid) {
            // update entry/registration
            const id = cleanseString(request.query.id || row.student_id);
            const name = cleanseString(request.query.name || row.Name);
            const date = cleanseString(
              request.query.date || row.rehearsal_date
            );
            const status = cleanseString(request.query.status || row.status);
            let sql = `UPDATE AttendanceRegistrations SET student_id=${id}, Name='${name}', rehearsal_date=date('${date}'), created_date=datetime('now'), registration_type='${status}' WHERE guid='${guid}';`;
            db.run(sql, (error) => {
              response.sendStatus(200);
            });
          } else {
            // guid doesn't exist
            response
              .status(403)
              .send(JSON.stringify({ message: "invalid guid: " + guid }));
          }
        }
      );
    }
  }
});

app.get("/deleteRegistration", (request, response) => {
  if (!isAdminLoggedin(request)) {
    response.sendStatus(403);
    return;
  }
  if (!process.env.DISALLOW_WRITE) {
    if (!request.query.guid) {
      response.sendStatus(403);
      return;
    }
    let guid = cleanseString(request.query.guid);
    db.all(
      `DELETE from AttendanceRegistrations WHERE guid='${guid}'`,
      (err, rows) => {
        console.log(JSON.stringify(rows));
        response.sendStatus(200);
      }
    );
  }
});

app.get("/GetStudentRegistrations", (request, response) => {
  if (!CanGetStudentRegistrations(request)) {
    response.sendStatus(403);
    return;
  }

  let studentid = cleanseString(request.query.id || "404");
  const sqlStatement = `
      SELECT AttendanceRegistrations.student_id as student_id, MAX(AttendanceRegistrations.created_date) AS created_date, 
        AttendanceRegistrations.rehearsal_date as rehearsal_date, AttendanceRegistrations.registration_type as registration_type, 
        RehearsalDates.trimester as trimester
      FROM AttendanceRegistrations 
        LEFT JOIN RehearsalDates on (RehearsalDates.rehearsal_date = AttendanceRegistrations.rehearsal_date)
      WHERE student_id = '${studentid}'
      GROUP BY DATE(AttendanceRegistrations.rehearsal_date)
      ORDER BY AttendanceRegistrations.rehearsal_date;`;

  db.all(sqlStatement, [], (err, rows) => {
    if (err) {
      console.error("Error executing query:", err);
      response.status(200).send();
      return;
    }

    if (typeof rows == "undefined") {
      console.log("no rows found :(");
      response.status(200).send();
    }
    let jsonstr = JSON.stringify(rows);
    response.status(200).send(JSON.stringify(jsonstr));
  });
});

app.get("/AddStudentRegistration", (request, response) => {
  if (!isStudentLoggedin(request)) {
    response.sendStatus(403);
    return;
  }

  let studentid = cleanseString(request.query.id || "404");
  let name = cleanseString(request.query.name || "404");
  let dateToAdd = cleanseString(request.query.date || "now");
  let status = cleanseString(request.query.status || "ABS");
  let statement = db.all(
    "SELECT * from AttendanceRegistrations WHERE student_id=? AND rehearsal_date=date(?)", //  AND rehearsal_date>date('now') + todo subtract 12h
    studentid,
    dateToAdd,
    (err, rows) => {
      if (err) {
        console.log("Error: " + err);
        response.status(404).send(`ERR001: ${err}`);
        return;
      }

      if (typeof rows == "undefined") {
        console.log(
          "Rows are undefined. Expected 0 rows to be returned no rows found."
        );
        response
          .status(404)
          .send("ERR002: An error occurred identifing your request");
        return;
      }

      let datenow = new Date(Date.now());
      let thisRehearsalDate = null;
      if (rows.length > 0) {
        thisRehearsalDate = new Date(rows[0].rehearsal_date); // dateToAdd
      } else {
        thisRehearsalDate = new Date(dateToAdd);
      }

      if (thisRehearsalDate >= datenow) {
        console.log(
          "Rows found. Given it's today or in the future we will allow it."
        );
      } else {
        console.log("Rows found. Given it's in the past we will not allow it.");
        response
          .status(403)
          .send(
            "The registration already exists. Unable to create a new entry."
          );
        return;
      }

      // Things are good. We can add the registration.
      let sql = `INSERT INTO AttendanceRegistrations (student_id, created_date, rehearsal_date, Name, guid, registration_type) VALUES (?, datetime('now'), date(?), ?,'${getUniqueId()}',?)`;
      db.run(sql, studentid, dateToAdd, name, status, (ins_error, ins_rows) => {
        if (ins_error) {
          console.log(`ERR003: ${ins_error}`);
          console.log(`SQL: ${sql}`);
          response.status(403).send({ message: `ERR003: ${ins_error}` });
          return;
        }
      });

      response.status(200).send();
    }
  );
});

app.get("/setstudentoutforterm", async (request, response) => {
  if (!CanAddRegistrations(request)) {
    response.sendStatus(403);
    return;
  }

  let studentid = cleanseString(request.query.id || "");
  let term = cleanseString(request.query.term || "");
  let remove = cleanseString(request.query.remove || "0");
  const registrationTypeOUT = "OUT";
  let name = "NA";

  if (studentid == "" || term == "") {
    response.status(403).send({
      message: `ERR001: Missing input paramerters studentid and term.`,
    });
  }

  let sqlStudent = `SELECT ID, Name FROM Students WHERE ID='${studentid}'`;
  let rowsStudent;
  await asyncAll(sqlStudent).then(
    (rows) => {
      rowsStudent = rows;
    },
    (error) => {
      console.log(`Student.Error: ${error}`);
      response
        .status(403)
        .send({ message: `ERR003: Error finding students. ${error}` });
    }
  );

  if (rowsStudent.length != 1) {
    console.log(`Student Items found: ${rowsStudent.length}. Expected: 1`);
    if (rowsStudent.length < 1) {
      response
        .status(403)
        .send({ message: `ERR004: 0 students found with that id.` });
    }
  }

  name = rowsStudent[0].Name;

  let sqlRehearsalDatesInTrimester = `select rehearsal_date from RehearsalDates where trimester = ${term} order by rehearsal_date`;
  let rowsRehearsals;
  await asyncAll(sqlRehearsalDatesInTrimester).then(
    (rows) => {
      rowsRehearsals = rows;
    },
    (error) => {
      console.log(`RehearsalDates.Error: ${error}`);
      response.status(403).send({ message: `ERR003: ${error}` });
    }
  );

  let currentRow = 0;
  const totalRows = rowsRehearsals.length;
  await rowsRehearsals.forEach(async (row) => {
    let dateToAdd = row.rehearsal_date;
    let sqlInsertAttendanceRegistration = `INSERT INTO AttendanceRegistrations (student_id, created_date, rehearsal_date, Name, guid, registration_type) VALUES ($studentid, datetime('now'), date($dateToAdd), $name,'${getUniqueId()}',$registrationType)`;
    let sqlRemoveAttendanceRegistration = `DELETE from AttendanceRegistrations where student_id = '${studentid}' AND rehearsal_date = '${dateToAdd}' AND Name = '${name}' AND registration_type = '${registrationTypeOUT}'`;

    let sqlInsertOrRemove =
      remove == "1"
        ? sqlRemoveAttendanceRegistration
        : sqlInsertAttendanceRegistration;

    if (remove == "1") {
      db.all(sqlRemoveAttendanceRegistration, (err, rows) => {
        if (err) {
          console.log("Error: " + err);
        }
        currentRow++;
        if (totalRows == currentRow) {
          let inout = remove == "1" ? "in" : "out";
          console.log(
            `Student: ${name} (${studentid}) marked as ${inout} for trimester: '${term}'.`
          ); // the server must complete this work... and new work can not be initiated without potential locks to the db...
        }
      });
    } else {
      let params = {
        $studentid: studentid,
        $dateToAdd: dateToAdd,
        $name: name,
        $registrationType: registrationTypeOUT,
      };
      await asyncRun(sqlInsertOrRemove, params).then(
        () => {
          currentRow++;
          if (totalRows == currentRow) {
            let inout = remove == "1" ? "in" : "out";
            console.log(
              `Student: ${name} (${studentid}) marked as ${inout} for trimester: '${term}'.`
            ); // the server must complete this work... and new work can not be initiated without potential locks to the db...
            // response.status(200).send(); // if we want to await all server calls to insert have completed return here.
          }
        },
        (error) => {
          currentRow++;

          let hasErrorMsg = "";
          if (remove == "1") {
            hasErrorMsg = `ERR005: Unable to delete attendance registration.`; // ${error}
          } else {
            hasErrorMsg = `ERR004: Unable to insert attendance registration.`; //  ${error}
          }
          console.log(`${hasErrorMsg}`);
          //response.status(403).send({ message: `${hasErrorMsg}` }); // can't send here as we have returned early below.
        }
      );
    }
  });

  response.status(200).send(); // remove this and set the other 200 response to return when done processing. set it here to return as fast as possible.
});

app.get("/registrations", (request, response) => {
  if (!CanGetRegistrations(request)) {
    response.sendStatus(403);
    return;
  }

  let date = cleanseString(request.query.date || "now");
  db.all(
    `SELECT * from AttendanceRegistrations WHERE rehearsal_date=date('${date}')`,
    (err, rows) => {
      response.send(JSON.stringify(rows));
    }
  );
});

app.get("/downloadRegistrations", (request, response) => {
  if (!CanGetRegistrations(request)) {
    response.sendStatus(403);
    return;
  }

  let date = cleanseString(request.query.date || "now");
  let orchestra = cleanseString(request.query.Orchestra || "YSO");
  let sql = `SELECT * from AttendanceRegistrations WHERE rehearsal_date=date('${date}')`;
  db.all(sql, (err, rows) => {
    if (err) {
      response.send({ message: "error!" });
      console.log(err, sql);
    } else {
      let csv = "guid, student_id, created_date, rehearsal_date, Name,type\n";
      rows.forEach((row) => {
        csv +=
          row.guid +
          "," +
          row.student_id +
          "," +
          row.created_date +
          "," +
          row.rehearsal_date +
          "," +
          row.Name +
          "," +
          row.registration_type +
          "\n";
      });
      response.setHeader(
        "Content-disposition",
        `attachment; filename=registrations_${date}.csv`
      );
      response.set("Content-Type", "text/csv");
      response.status(200).send(csv);
    }
  });
});

app.get("/downloadRegistrationsSimpleDupeFinder", (request, response) => {
  if (!CanGetRegistrations(request)) {
    response.sendStatus(403);
    return;
  }

  let date = cleanseString(request.query.date || "now");
  let orchestra = cleanseString(request.query.Orchestra || "YSO");

  let sql = `SELECT Students.ID as ID, Students.Name as Name, 
            COALESCE(
              CASE
                  WHEN latest_AttendanceRegistrations.registration_type = 'P' THEN 'P'
                  WHEN latest_AttendanceRegistrations.registration_type = 'ABS' THEN 'ABS'
                  ELSE 'ABS-NR' -- Handle other cases if needed
              END,
              'Unknown' -- Default value for missing attendance records
          ) AS registration_type    
          FROM Students 
          LEFT OUTER JOIN (
            SELECT AttendanceRegistrations.student_id as ID, AttendanceRegistrations.created_date as created_date, AttendanceRegistrations.rehearsal_date as rehearsal_date, AttendanceRegistrations.registration_type as registration_type 
            FROM AttendanceRegistrations
            WHERE (AttendanceRegistrations.student_id, AttendanceRegistrations.created_date) IN (
              SELECT AttendanceRegistrations.student_id as ID, max(AttendanceRegistrations.created_date)
              FROM AttendanceRegistrations
              WHERE AttendanceRegistrations.rehearsal_date=date('${date}')	
              GROUP BY ID
              )
          ) AS latest_AttendanceRegistrations
          ON (
            Students.ID=latest_AttendanceRegistrations.ID AND rehearsal_date=date('${date}')
            ) 
          WHERE Students.Orchestra='${orchestra}'ORDER BY ID`;

  db.all(sql, (err, rows) => {
    if (err) {
      response.send({ message: "error!" });
      console.log(err, sql);
    } else {
      let csv = "student_id, type\n";
      rows.forEach((row) => {
        csv += row.ID + "," + row.registration_type + "\n";
      });
      response.setHeader(
        "Content-disposition",
        `attachment; filename=registrations_${date}.csv`
      );
      response.set("Content-Type", "text/csv");
      response.status(200).send(csv);
    }
  });
});

app.get("/downloadRegistrationsSimple", (request, response) => {
  if (!CanGetRegistrations(request)) {
    response.sendStatus(403);
    return;
  }

  let date = cleanseString(request.query.date || "now");
  let orchestra = cleanseString(request.query.Orchestra || "YSO");
  let sql = `SELECT Students.ID as ID, Students.Name as Name, 
            COALESCE(
              CASE
                  WHEN latest_AttendanceRegistrations.registration_type = 'P' THEN 'P'
                  WHEN latest_AttendanceRegistrations.registration_type = 'ABS' THEN 'ABS'
                  ELSE 'ABS-NR' -- Handle other cases if needed
              END,
              'Unknown' -- Default value for missing attendance records
          ) AS registration_type    
          FROM Students 
          LEFT OUTER JOIN (
            SELECT AttendanceRegistrations.student_id as ID, AttendanceRegistrations.created_date as created_date, AttendanceRegistrations.rehearsal_date as rehearsal_date, AttendanceRegistrations.registration_type as registration_type 
            FROM AttendanceRegistrations
            WHERE (AttendanceRegistrations.student_id, AttendanceRegistrations.created_date) IN (
              SELECT AttendanceRegistrations.student_id as ID, max(AttendanceRegistrations.created_date)
              FROM AttendanceRegistrations
              WHERE AttendanceRegistrations.rehearsal_date=date('${date}')	
              GROUP BY ID
              )
          ) AS latest_AttendanceRegistrations
          ON (
            Students.ID=latest_AttendanceRegistrations.ID AND rehearsal_date=date('${date}')
            ) 
          WHERE Students.Orchestra='${orchestra}'ORDER BY ID`;
  db.all(sql, (err, rows) => {
    if (err) {
      response.send({ message: "error!" });
      console.log(err, sql);
    } else {
      let csv = "student_id, type\n";
      rows.forEach((row) => {
        csv += row.ID + "," + row.registration_type + "\n";
      });
      response.setHeader(
        "Content-disposition",
        `attachment; filename=registrations_${date}.csv`
      );
      response.set("Content-Type", "text/csv");
      response.status(200).send(csv);
    }
  });
});

app.get("/downloadRegistrationsSimple2", (request, response) => {
  if (!CanGetRegistrations(request)) {
    response.sendStatus(403);
    return;
  }

  let date = cleanseString(request.query.date || "now");
  let orchestra = cleanseString(request.query.Orchestra || "YSO");
  let sql = `SELECT Students.ID as ID, Students.Name as Name, 
            COALESCE(
              CASE
              WHEN latest_AttendanceRegistrations.registration_type isnull THEN 'ABS-NR'
              ELSE latest_AttendanceRegistrations.registration_type 
          END,
          'Unknown' -- should not happen
          ) AS registration_type,
          latest_AttendanceRegistrations.rehearsal_date            
          FROM Students 
          LEFT OUTER JOIN (
            SELECT AttendanceRegistrations.student_id as ID, AttendanceRegistrations.created_date as created_date, AttendanceRegistrations.rehearsal_date as rehearsal_date, AttendanceRegistrations.registration_type as registration_type 
            FROM AttendanceRegistrations
            WHERE (AttendanceRegistrations.student_id, AttendanceRegistrations.created_date) IN (
              SELECT AttendanceRegistrations.student_id as ID, max(AttendanceRegistrations.created_date)
              FROM AttendanceRegistrations
              WHERE AttendanceRegistrations.rehearsal_date=date('${date}')	
              GROUP BY ID
              )
          ) AS latest_AttendanceRegistrations
          ON (
            Students.ID=latest_AttendanceRegistrations.ID AND rehearsal_date=date('${date}')
            ) 
          WHERE Students.Orchestra='${orchestra}'ORDER BY ID`;
  db.all(sql, (err, rows) => {
    if (err) {
      response.send({ message: "error!" });
      console.log(err, sql);
    } else {
      let csv = "";
      ("student_id, type\n");
      rows.forEach((row) => {
        csv += row.registration_type + "\n";
      });
      response.setHeader(
        "Content-disposition",
        `attachment; filename=registrations_${date}.csv`
      );
      response.set("Content-Type", "text/csv");
      response.status(200).send(csv);
    }
  });
});

app.get("/GetRegistrationsForDate", (request, response) => {
  if (!CanGetRegistrations(request)) {
    response.sendStatus(403);
    return;
  }

  let date = cleanseString(request.query.date || "now");
  let orchestra = cleanseString(request.query.Orchestra || "YSO");

  //console.log(`Date: ${date}, Orchestra: ${orchestra}`);
  let sql = `SELECT Students.ID as ID, Students.Name as Name, 
              COALESCE(
                CASE
                  WHEN latest_AttendanceRegistrations.registration_type isnull THEN 'ABS-NR'
                  ELSE latest_AttendanceRegistrations.registration_type 
                END,
                'Unknown' -- should not happen
              ) AS registration_type  
              , COALESCE(
                CASE
                  WHEN latest_AttendanceRegistrations.rehearsal_date isnull THEN '${date}'
                  ELSE latest_AttendanceRegistrations.rehearsal_date 
                END,
                'Unknown' -- should not happen
              ) AS rehearsal_date   
          FROM Students 
          LEFT OUTER JOIN (
            SELECT AttendanceRegistrations.student_id as ID, AttendanceRegistrations.created_date as created_date, AttendanceRegistrations.rehearsal_date as rehearsal_date, AttendanceRegistrations.registration_type as registration_type 
            FROM AttendanceRegistrations
            WHERE (AttendanceRegistrations.student_id, AttendanceRegistrations.created_date) IN (
              SELECT AttendanceRegistrations.student_id as ID, max(AttendanceRegistrations.created_date)
              FROM AttendanceRegistrations
              WHERE AttendanceRegistrations.rehearsal_date=date('${date}')	
              GROUP BY ID
              )
          ) AS latest_AttendanceRegistrations
          ON (
            Students.ID=latest_AttendanceRegistrations.ID AND rehearsal_date=date('${date}')
            ) 
          WHERE Students.Orchestra='${orchestra}'ORDER BY ID`;
  db.all(sql, (err, rows) => {
    if (err) {
      console.log(`Error: ${err}, SQL: ${sql}`);
      response.status(200).send(`{ message: "unable to fetch data!" }`);
    } else {
      response.status(200).send(JSON.stringify(rows));
    }
  });
});

app.get("/GetStudentRegistrationsForAllDates", async (request, response) => {
  if (!CanGetRegistrations(request)) {
    response.sendStatus(403);
    return;
  }

  let AllErrors = [];
  let AllRows = [];
  let datesProcessed = 0;
  let orchestra = cleanseString(request.query.Orchestra || "YSO");
  let trimester = cleanseString(request.query.Trimester || "ALL");
  let instrument = cleanseString(request.query.Instrument || "ALL");
  let studentType = cleanseString(request.query.StudentType || "ALL");
  let attendanceState = cleanseString(request.query.AttendanceState || "ALL");
  let inputRehearsalDate = cleanseString(request.query.RehearsalDate || "ALL");

  let orchestraSQL = "1=1";
  if (orchestra.toUpperCase() != "ALL") {
    orchestraSQL = `Students.Orchestra='${orchestra}'`;
  }

  let instrumentSQL = "";
  if (instrument.toUpperCase() != "ALL") {
    instrumentSQL = `AND Students.Instrument='${instrument}'`;
  }

  let studentTypeSQL = ""; // ALL
  if (studentType.toUpperCase() == "RA") {
    studentTypeSQL = `AND Students.IsRA='${1}'`;
  }

  let attendanceStateSQL = "";
  if (attendanceState.toUpperCase() != "ALL") {
    if (attendanceState.toUpperCase() == "ABS-NR") {
      attendanceStateSQL = `AND registration_type ISNULL`;
    } else {
      attendanceStateSQL = `AND registration_type='${attendanceState}'`;
    }
  }

  await getRehearsalDates(trimester, async (tmpRehearsalDates) => {
    if (inputRehearsalDate != "ALL") {
      // note: due to async handling the function risk never returning any values, thus keeping this for now.
      tmpRehearsalDates = [1];
      tmpRehearsalDates[0] = {
        rehearsal_date: inputRehearsalDate,
        rehearsal_type: "---",
        trimester: 0,
      };
    }
    await tmpRehearsalDates.forEach(async (rehearsalDate) => {
      let date = rehearsalDate["rehearsal_date"];
      let sql = getSQLForStudentRegistration(
        date,
        orchestraSQL,
        instrumentSQL,
        studentTypeSQL,
        attendanceStateSQL
      );
      await db.all(sql, (err, rows) => {
        if (err) {
          AllErrors[AllErrors.length] = err;
          console.log(`Error: ${err}, SQL: ${sql}`);
          datesProcessed++;
        } else {
          if (rows.length > 0) {
            AllRows[AllRows.length] = rows;
          }
          datesProcessed++;
        }

        // Are we done? Send the response back from here as this is the only sync point.
        if (tmpRehearsalDates.length == datesProcessed) {
          // datesProcessed : AllRows.length + AllErrors.length
          if (AllErrors.length != 0) {
            response.status(203).send(JSON.string(AllErrors));
          }

          // As the foreach is async the array will not be sorted, and db.all will be run in "random order" by date, even if the rehearsaldates are returned ordered.
          // Each row does contain entries with the same data from the db.all query.
          // Sorting according to rehearsal date.
          // -1: first is less, 0: they are the same, 1: second is less
          AllRows.sort((rowA, rowB) => {
            let aValue = rowA[0].rehearsal_date;
            let bValue = rowB[0].rehearsal_date;
            if (aValue < bValue) return -1;
            if (aValue > bValue) return 1;
            return 0;
          });

          response.status(200).send(JSON.stringify(AllRows));
        }
      });
    }); // end foreach rehearsalDate
  });
});

app.get("/GetStudentRegistrationsForAllDates_2", async (request, response) => {
  if (!CanGetRegistrations(request)) {
    response.sendStatus(403);
    return;
  }

  let AllErrors = [];
  let AllRows = [];
  let datesProcessed = 0;
  let orchestra = cleanseString(request.query.Orchestra || "YSO");
  let trimester = cleanseString(request.query.Trimester || "ALL");
  let instrument = cleanseString(request.query.Instrument || "ALL");
  let studentType = cleanseString(request.query.StudentType || "ALL");
  let attendanceState = cleanseString(request.query.AttendanceState || "ALL");
  let inputRehearsalDate = cleanseString(request.query.RehearsalDate || "ALL");

  let orchestraSQL = "1=1";
  if (orchestra.toUpperCase() != "ALL") {
    orchestraSQL = `Students.Orchestra='${orchestra}'`;
  }

  let instrumentSQL = "";
  if (instrument.toUpperCase() != "ALL") {
    instrumentSQL = `AND Students.Instrument='${instrument}'`;
  }

  let studentTypeSQL = ""; // ALL
  if (studentType.toUpperCase() == "RA") {
    studentTypeSQL = `AND Students.IsRA='${1}'`;
  }

  let attendanceStateSQL = "";
  if (attendanceState.toUpperCase() != "ALL") {
    if (attendanceState.toUpperCase() == "ABS-NR") {
      attendanceStateSQL = `AND registration_type ISNULL`;
    } else {
      attendanceStateSQL = `AND registration_type='${attendanceState}'`;
    }
  }

  await getRehearsalDates(trimester, async (tmpRehearsalDates) => {
    if (inputRehearsalDate != "ALL") {
      // note: due to async handling the function risk never returning any values, thus keeping this for now.
      tmpRehearsalDates = [1];
      tmpRehearsalDates[0] = {
        rehearsal_date: inputRehearsalDate,
        rehearsal_type: "---",
        trimester: 0,
      };
    }
    await tmpRehearsalDates.forEach(async (rehearsalDate) => {
      let date = rehearsalDate["rehearsal_date"];
      let sql = getSQLForStudentRegistration(
        date,
        orchestraSQL,
        instrumentSQL,
        studentTypeSQL,
        attendanceStateSQL
      );
      let dayResult = await asyncAll(sql);
      AllRows[AllRows.length] = dayResult;
      datesProcessed++;

      if (tmpRehearsalDates.length == datesProcessed) {
        // As the foreach is async the array will not be sorted, and db.all will be run in "random order" by date, even if the rehearsaldates are returned ordered.
        // Each row does contain entries with the same data from the db.all query.
        // Sorting according to rehearsal date.
        // -1: first is less, 0: they are the same, 1: second is less
        AllRows.sort((rowA, rowB) => {
          let aValue = rowA[0].rehearsal_date;
          let bValue = rowB[0].rehearsal_date;
          if (aValue < bValue) return -1;
          if (aValue > bValue) return 1;
          return 0;
        });
        response.status(200).send(JSON.stringify(AllRows));
      }
    }); // end foreach rehearsalDate
  });
});

function getSQLForStudentRegistration(
  date,
  orchestraSQL,
  instrumentSQL,
  studentTypeSQL,
  attendanceStateSQL
) {
  let sql = `SELECT Students.ID as ID, Students.Name as Name, Students.Instrument as Instrument, Students.Orchestra as Orchestra, Students.IsRA as IsRA,
      COALESCE(
        CASE
          WHEN date('${date}') > date('now') and latest_AttendanceRegistrations.registration_type isnull THEN ''  
          WHEN latest_AttendanceRegistrations.registration_type isnull THEN 'ABS-NR'
          ELSE latest_AttendanceRegistrations.registration_type 
        END,
        'Unknown' -- should not happen
      ) AS registration_type  
      , COALESCE(
        CASE
          WHEN latest_AttendanceRegistrations.rehearsal_date isnull THEN '${date}'
          ELSE latest_AttendanceRegistrations.rehearsal_date 
        END,
        'Unknown' -- should not happen
      ) AS rehearsal_date   
    FROM Students 
    LEFT OUTER JOIN (
    SELECT AttendanceRegistrations.student_id as ID, AttendanceRegistrations.created_date as created_date, 
      AttendanceRegistrations.rehearsal_date as rehearsal_date, AttendanceRegistrations.registration_type as registration_type 
    FROM AttendanceRegistrations
    WHERE (AttendanceRegistrations.student_id, AttendanceRegistrations.created_date) IN (
      SELECT AttendanceRegistrations.student_id as ID, max(AttendanceRegistrations.created_date)
      FROM AttendanceRegistrations
      WHERE AttendanceRegistrations.rehearsal_date=date('${date}') 
      GROUP BY ID
      )
    ) AS latest_AttendanceRegistrations
    ON (
    Students.ID=latest_AttendanceRegistrations.ID AND rehearsal_date=date('${date}')
    ) 
    WHERE ${orchestraSQL} ${instrumentSQL} ${studentTypeSQL} ${attendanceStateSQL} ORDER BY ID`;
  return sql;
}

let rehearsalDates = [];
async function getRehearsalDates(callback) {
  await getRehearsalDates(undefined, callback);
}

async function getRehearsalDates(trimester, callback) {
  if (
    (trimester == undefined || trimester == "ALL" || trimester == "Today") &&
    rehearsalDates.length > 0
  ) {
    callback(rehearsalDates);
    return;
  }

  let sql = "SELECT * from RehearsalDates ORDER BY rehearsal_date";

  if (
    trimester !== undefined &&
    trimester != "ALL" &&
    trimester.toUpperCase() != "TODAY"
  ) {
    sql = `SELECT * from RehearsalDates WHERE trimester=${trimester} ORDER BY rehearsal_date`;
  }

  db.all(`${sql}`, (err, rows) => {
    if (err) {
      console.log(`SQL Error: ${err}, SQL: ${sql}`);
    }

    // only cache rehearsal dates when retrieving all dates.
    if (trimester == undefined || trimester == "ALL") {
      rehearsalDates = rows;
    }

    callback(rows);
  });
}

app.get("/getRehearsalDates", async (request, response) => {
  if (!CanGetRehearsalDates(request)) {
    response.sendStatus(403);
    return;
  }
  await getRehearsalDates(undefined, (dates) => {
    response.send(JSON.stringify(dates));
  });
});

app.get("/deleteRehearsalDate", (request, response) => {
  if (!isAdminLoggedin(request)) {
    response.sendStatus(403);
    return;
  }
  if (!process.env.DISALLOW_WRITE) {
    if (!request.query.date) {
      response.sendStatus(403);
      return;
    }
    let date = cleanseString(request.query.date);
    db.all(
      `DELETE from RehearsalDates WHERE rehearsal_date='${date}'`,
      (err, rows) => {
        console.log(JSON.stringify(rows));
        rehearsalDates = [];
        getRehearsalDates((dates) => {
          response.status(200).send(dates);
        });
      }
    );
  }
});

app.get("/saveRehearsalDate", (request, response) => {
  if (!isAdminLoggedin(request)) {
    response.sendStatus(403);
    return;
  }
  if (!process.env.DISALLOW_WRITE) {
    if (!request.query.date) {
      response.sendStatus(403);
      return;
    }
    let date = cleanseString(request.query.date);
    getRehearsalDates((dates) => {
      if (dates.some((o) => o.rehearsal_date == date)) {
        // if date already exists, this is an update operation
        let updates = "";
        if (request.query.type) {
          updates +=
            "rehearsal_type='" + cleanseString(request.query.type) + "'";
        }
        if (request.query.type && request.query.trimester) {
          updates += ", ";
        }
        if (request.query.trimester) {
          updates += "trimester=" + cleanseString(request.query.trimester);
        }
        if (updates == "") {
          response.status(403).send(rehearsalDates);
          return;
        }
        let sql = `UPDATE RehearsalDates SET ${updates} WHERE rehearsal_date=${date};`;
        db.get(sql, (error, row) => {
          if (error) {
            response.send({ message: "error!" });
            console.log(error, sql);
          } else {
            response.status(200).send(JSON.stringify(rehearsalDates));
          }
        });
      } else {
        // otherwise we are inserting
        let type = cleanseString(request.query.type || "null");
        let trimester = cleanseString(
          request.query.trimester || "" + dates[dates.length - 1].trimester
        );
        let sql = `INSERT INTO RehearsalDates (rehearsal_date, rehearsal_type, trimester) VALUES (date('${date}'),'${type}',${trimester});`;
        db.get(sql, (error, row) => {
          if (error) {
            response.send({ message: "error!" });
            console.log(error, sql);
          } else {
            rehearsalDates.push({
              rehearsal_date: date,
              rehearsal_type: type,
              trimester: trimester,
            });
            response.status(200).send(JSON.stringify(rehearsalDates));
          }
        });
      }
    });
  }
});

app.get("/deleteStudent", (request, response) => {
  if (!isAdminLoggedin(request)) {
    response.sendStatus(403);
    return;
  }
  if (!process.env.DISALLOW_WRITE) {
    if (!request.query.id) {
      response.sendStatus(403);
      return;
    }
    let id = cleanseString(request.query.id);
    db.all(`DELETE from Students WHERE ID='${id}'`, (err, rows) => {
      console.log(JSON.stringify(rows));
      response.sendStatus(200);
    });
  }
});

app.get("/saveStudent", (request, response) => {
  if (!isAdminLoggedin(request)) {
    response.sendStatus(403);
    return;
  }
  if (!process.env.DISALLOW_WRITE) {
    if (!request.query.id) {
      response.sendStatus(403);
      return;
    }
    let id = cleanseString(request.query.id);
    db.get(`SELECT * from Students WHERE ID=${id}`, (err, row) => {
      if (row && row.ID == id) {
        // id already exists, update
        let name = cleanseString(request.query.name || row.Name);
        let instrument = cleanseString(
          request.query.instrument || row.Instrument
        );
        let section = cleanseString(
          request.query.instrumentSection || row.InstrumentSection
        );
        let email = cleanseString(request.query.email || row.Email);
        let parent = cleanseString(
          request.query.parentEmail || row.ParentEmail
        );
        let orchestra = cleanseString(request.query.orchestra || row.Orchestra);

        let sql = `UPDATE Students SET Name='${name}', Instrument='${instrument}', InstrumentSection='${section}', Email='${email}', ParentEmail='${parent}', Orchestra='${orchestra}' WHERE ID=${id};`;
        console.log(sql);
        db.run(sql, (error) => {
          if (error) {
            response.send({ message: "error!" });
            console.log(error, sql);
          } else {
            response.status(200).send(JSON.stringify(row));
          }
        });
      } else {
        // otherwise we are inserting
        let name = cleanseString(request.query.name || "no name");
        let instrument = cleanseString(
          request.query.instrument || "no instrument"
        );
        let section = cleanseString(request.query.instrumentSection || "0");
        let email = cleanseString(request.query.email || "no email");
        let parent = cleanseString(
          request.query.parentEmail || "no parent email"
        );
        let sql = `INSERT INTO Students (ID, Name, Instrument, InstrumentSection, Email, ParentEmail) VALUES (${id},'${name}','${instrument}','${section}','${email}','${parent}');`;
        db.get(sql, (error, row) => {
          if (error) {
            response.send({ message: "error!" });
            console.log(error, sql);
          } else {
            response.sendStatus(200);
          }
        });
      }
    });
  }
});

app.get("/downloadStudents", (request, response) => {
  if (!isAdminLoggedin(request)) {
    response.sendStatus(403);
    return;
  }

  db.all(`SELECT * from Students`, (err, rows) => {
    let csv =
      "ID, Name, Instrument, InstrumentSection, Email, ParentEmail, Orchestra\n";
    rows.forEach((row) => {
      csv +=
        row.ID +
        "," +
        row.Name +
        "," +
        row.Instrument +
        "," +
        row.InstrumentSection +
        "," +
        row.Email +
        "," +
        row.ParentEmail +
        "," +
        row.Orchestra +
        "\n";
    });
    response.setHeader(
      "Content-disposition",
      `attachment; filename=students.csv`
    );
    response.set("Content-Type", "text/csv");
    response.status(200).send(csv);
  });
});

// helper function that prevents html/css/script malice
const cleanseString = function (string) {
  return string.replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

function getUniqueId() {
  return (
    new Date().getTime().toString(36) + Math.random().toString(36).slice(2)
  );
}

// listen for requests :)
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});
