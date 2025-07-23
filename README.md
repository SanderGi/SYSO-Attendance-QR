# qrcodescanner
[![maintenance-status](https://img.shields.io/badge/maintenance-deprecated-red.svg)](https://gist.github.com/taiki-e/ad73eaea17e2e0372efb76ef6b38f17b)

QR-Code based attendance software made for the [Seattle Youth Symphony Orchestras](https://syso.org/). For a production ready version of this software, check out [AttendQR](https://attendqr.com).

## google-form-app

Simple QR Scanner for attendance. Works by submitting a google form. Only uses static HTML, no server. To configure, create a Google Form with a first name, last name, and ID input. Then "export pre-filled form" and enter the values into client.js.

## sqlite-app

More secure and feature rich application. Has a server and uses SQLite to store attendance records. Made in collaboration with [Henrik Metzger](https://www.linkedin.com/in/henrikmetzger/). To configure, make a copy of `.env.example` and rename to `.env`. Then fill in the keys with random values.
