// PASSKEY and STUDENTKEY must be setup as environment variables for the system to work.
// You can set these for the system or the session the way you prefer, however ensure these are not in source code!
console.log(
  `PASSKEY: ${process.env.PASSKEY != null}, STAFFKEY: ${
    process.env.STAFFKEY != null
  }, STUDENTKEY: ${process.env.STUDENTKEY != null}`
);

export function isAdminLoggedin(request) {
  if (
    !request.headers.passkey ||
    request.headers.passkey !== process.env.PASSKEY
  ) {
    console.log("no/wrong admin passkey");
    return false;
  } else {
    if (adminLogin != loginType) {
      loginType = adminLogin;
      console.log("Admin signed in");
    }
    return true;
  }
}

export function isJuniorLoggedin(request) {
  if (
    !request.headers.passkey ||
    request.headers.passkey !== process.env.JUNIORKEY
  ) {
    console.log("no/wrong junior passkey");
    return false;
  } else {
    if (juniorLogin != loginType) {
      loginType = juniorLogin;
      console.log("Junior signed in");
    }
    return true;
  }
}

export function isStaffLoggedin(request) {
  if (
    !request.headers.passkey ||
    request.headers.passkey !== process.env.STAFFKEY
  ) {
    console.log(`no/wrong staff passkey.`);
    return false;
  } else {
    if (staffLogin != loginType) {
      loginType = staffLogin;
      console.log("Staff signed in");
    }
    return true;
  }
}

export function isScannerLoggedin(request) {
  if (
    !request.headers.passkey ||
    request.headers.passkey !== process.env.SCANKEY
  ) {
    console.log("no/wrong scanner passkey");
    return false;
  } else {
    if (scannerLogin != loginType) {
      loginType = scannerLogin;
      console.log("Scanner signed in");
    }
    return true;
  }
}

let loginType = 0;
const noLogin = 0;
const adminLogin = 1;
const juniorLogin = 2;
const studentLogin = 3;
const scannerLogin = 4;
const staffLogin = 5;

export function isStudentLoggedin(request) {
  if (
    !request.headers.studentkey ||
    request.headers.studentkey !== process.env.STUDENTKEY
  ) {
    console.log("no/wrong studentkey");
    return false;
  } else {
    if (studentLogin != loginType) {
      loginType = studentLogin;
      console.log("Student signed in");
    }
    return true;
  }
}

export function IsKnownPasskey(request) {
  return (
    isAdminLoggedin(request) ||
    isJuniorLoggedin(request) ||
    isStaffLoggedin(request) ||
    isScannerLoggedin(request)
  );
}

export function CanAddRegistrations(request) {
  return (
    isAdminLoggedin(request) ||
    isJuniorLoggedin(request) ||
    isStaffLoggedin(request) ||
    isScannerLoggedin(request)
  );
}

export function CanGetRehearsalDates(request) {
  return (
    isAdminLoggedin(request) ||
    isJuniorLoggedin(request) ||
    isStaffLoggedin(request) ||
    isScannerLoggedin(request) ||
    isStudentLoggedin(request)
  );
}

export function CanGetRegistrations(request) {
  return (
    isAdminLoggedin(request) ||
    isJuniorLoggedin(request) ||
    isStaffLoggedin(request)
  );
}

export function CanGetStudentRegistrations(request) {
  return (
    isAdminLoggedin(request) ||
    isJuniorLoggedin(request) ||
    isStaffLoggedin(request) ||
    isStudentLoggedin(request)
  );
}
