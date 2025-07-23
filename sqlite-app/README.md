# syso-attendance

A QR scanner that adds attendance registrations to a database. Uses SQLite as a database management system.

## API Documentation

Everything should have a `passkey` header set to the passkey stored in the dotenv file in order to do anything.

### GET `/addRegistration?id={ID}` `/addRegistration?id={ID}&name={NAME}`
Called to add an attendance registration to the database. Returns the Name corresponding to the ID in the Students data table.
- {ID} is an id in the Students database or 404 for a missing id
- [optional] {NAME} is the Name to associate with the registration

### GET `/registrations` ``

**Example:**
Get JSON version of all registrations from a date in client. Includes all information such as GUID which is normally hidden from the download:
```
fetch("/registrations?date=2022%2D09%2D10",{headers:{'passkey':sessionStorage.getItem("passkey")}}).then((res) => {
  res.json().then((data) => {
      console.log(data);
  });
});
```
