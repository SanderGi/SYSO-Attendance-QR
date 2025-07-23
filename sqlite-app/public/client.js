function handleSubmit(name) {
  let comments = [
    "you look especially handsome today!",
    "beautiful shoes you're wearing today!",
    "nice semi-tones :P",
    "did you practice?",
    "how's the intonation?",
  ];
  let comment = comments[Math.floor(Math.random() * comments.length)];
  document.getElementById("welcome").innerHTML = `
    <h3 style="color: black">Welcome ${name}, ${comment}</h3>
    <div class="btn-wrapper">
      <button class="btn" id="next">Scan Next</button>
    </div>
  `;
  document.getElementById("next").addEventListener("click", next);
  document.getElementById("welcome").style.display = "block";
  document.getElementById("reader").style.display = "none";
}

async function sendRegistrationToBackend(name, id) {
  let date =
    rehearsalDates[document.getElementById("date").selectedIndex]
      .rehearsal_date;
  let status =
    document.getElementById("status").options[
      document.getElementById("status").selectedIndex
    ].value;
  return await fetch(
    `/addRegistration?name=${name}&id=${id}&date=${date}&status=${status}`,
    { headers: { passkey: localStorage.getItem("passkey") } }
  );
}

let lastId = 404;
function onScanSuccess(decodedText, decodedResult) {
  // Handle on success condition with the decoded text or result.
  try {
    html5QrcodeScanner.pause();
  } finally {
    console.log(`Scan result: ${decodedText}`, decodedResult);
  }
  let url = new URL(decodedText);
  if (
    url.hostname == "syso-attendance.glitch.me" ||
    url.hostname == "syso-attendance"
  ) {
    // only accept QR codes with a specific URL
    let params = url.searchParams;
    let name = params.get("name") || "no name";
    let id = params.get("id") || 404;
    console.log(`ID: ${id}, Name:${name}`);
    if (lastId == id && id != 404) {
      html5QrcodeScanner.resume();
      return;
    } else {
      lastId = id;
    }
    sendRegistrationToBackend(name, id).then((res) => {
      console.log(`Response: ${res}`);
      res.json().then(
        (data) => {
          let nameToShow = name;
          console.log(`Name2show: ${nameToShow}, data:${data}`);
          if (data.length > 0) {
            nameToShow = data[0].Name;
          }
          handleSubmit(nameToShow);
        },
        (err) => {
          console.log(`Error: ${err}`);
        }
      );
    });
  }
}

function next() {
  try {
    html5QrcodeScanner.resume();
    lastId = 404;
  } finally {
    document.getElementById("welcome").style.display = "none";
    document.getElementById("reader").style.display = "block";
  }
}

let html5QrcodeScanner = new Html5QrcodeScanner("reader", {
  fps: 10,
  qrbox: 250,
});
html5QrcodeScanner.render(onScanSuccess);

function handleURL() {
  let params = new URL(window.location).searchParams;
  let id = params.get("id");
  if (id) {
    let name = params.get("name") || "no name";
    sendRegistrationToBackend(name, id).then((res) => {
      res.json().then((data) => {
        console.log(data);
        handleSubmit(data[0].Name);
      });
    });
  }
}

let rehearsalDates = [];
function updateDates(dates) {
  rehearsalDates = dates;
  [...document.getElementsByClassName("date")].forEach((elem) => {
    while (elem.firstChild) {
      elem.removeChild(elem.firstChild);
    }
    let searchDate = new Date(Date.now());
    let minDiff = Infinity;
    rehearsalDates.forEach((date) => {
      let diff = Math.abs(new Date(date.rehearsal_date + " ") - searchDate);
      minDiff = minDiff > diff ? diff : minDiff;
    });

    var thisSearchMonth = searchDate.getUTCMonth() + 1; //months from 1-12
    var thisSearchDay = searchDate.getUTCDate();
    var thisSearchYear = searchDate.getUTCFullYear();

    rehearsalDates.forEach((date) => {
      let option = document.createElement("option");
      option.textContent =
        date.rehearsal_date +
        "—" +
        (date.rehearsal_type ? date.rehearsal_type : "rehearsal") +
        "—trimester " +
        date.trimester;
      let thisRehearsalDate = new Date(date.rehearsal_date);
      var thisRehearsalMonth = thisRehearsalDate.getUTCMonth() + 1; //months from 1-12
      var thisRehearsalDay = thisRehearsalDate.getUTCDate();
      var thisRehearsalYear = thisRehearsalDate.getUTCFullYear();
      if (
        thisSearchYear == thisRehearsalYear &&
        thisSearchMonth == thisRehearsalMonth &&
        thisSearchDay == thisRehearsalDay
      ) {
        option.selected = true;
      }

      if (
        Math.abs(new Date(date.rehearsal_date + " ") - searchDate) == minDiff
      ) {
        option.selected = true;
      }
      elem.appendChild(option);
    });
  });
  handleURL();
}
fetch("/getRehearsalDates", {
  headers: { passkey: localStorage.getItem("passkey") },
}).then((res) => {
  if (res.status == 200) {
    res.json().then((dates) => {
      updateDates(dates);
    });
  } else {
    alert("Authentication failed. Please sign-in.");
  }
});
