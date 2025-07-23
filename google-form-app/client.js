///////////////////////////// Configure These Values /////////////////////////////
const FORM_URL = "https://docs.google.com/forms/d/e/INSERT_FORM_ID_HERE";
const FIRST_NAME_ENTRY = "&entry.INSERT_NUMBER";
const LAST_NAME_ENTRY = "&entry.INSERT_NUMBER";
const ID_ENTRY = "&entry.INSERT_NUMBER";
//////////////////////////////////////////////////////////////////////////////////

function handleSubmit(first, last) {
  let comments = [
    "you look especially handsome today!",
    "beautiful shoes you're wearing today!",
    "nice semi-tones :)",
    "did you practice?",
  ];
  let comment = comments[Math.floor(Math.random() * comments.length)];
  document.getElementById("welcome").innerHTML = `
      <h2>Welcome ${first} ${last}, ${comment}</h2>
      <div class="btn-wrapper">
        <button class="btn" id="next">Scan Next</button>
      </div>
    `;
  document.getElementById("next").addEventListener("click", next);
  document.getElementById("welcome").style.display = "block";
  document.getElementById("reader").style.display = "none";
}

function submitGoogleForm(url) {
  let iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.style.height = "0px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);
  iframe.onload = () => {
    document.body.removeChild(iframe);
  };
}

function manualSubmit() {
  try {
    html5QrcodeScanner.pause();
  } finally {
    let first = prompt("Please enter your first name below: ");
    if (first == null) {
      html5QrcodeScanner.resume();
      return;
    }
    let last = prompt("Please enter your last name below: ");
    if (last == null) {
      html5QrcodeScanner.resume();
      return;
    }
    let id = null;
    let url = `${FORM_URL}/formResponse?usp=pp_url${FIRST_NAME_ENTRY}=${first}${LAST_NAME_ENTRY}=${last}${ID_ENTRY}=${id}&submit=Submit`;
    submitGoogleForm(url);
    handleSubmit(first, last);
  }
}
document.getElementById("manual").addEventListener("click", manualSubmit);

function onScanSuccess(decodedText, decodedResult) {
  // Handle on success condition with the decoded text or result.
  html5QrcodeScanner.pause();
  console.log(`Scan result: ${decodedText}`, decodedResult);
  submitGoogleForm(decodedText);
  let firstIX = decodedText.indexOf(FIRST_NAME_ENTRY) + FIRST_NAME_ENTRY.length;
  let secondIX = decodedText.indexOf(LAST_NAME_ENTRY) + LAST_NAME_ENTRY.length;
  let thirdIX = decodedText.indexOf(ID_ENTRY) + ID_ENTRY.length;
  let first = decodedText.substr(
    firstIX,
    secondIX - firstIX - LAST_NAME_ENTRY.length
  );
  let last = decodedText.substr(secondIX, thirdIX - secondIX - ID_ENTRY.length);
  handleSubmit(first, last);
}

function next() {
  html5QrcodeScanner.resume();
  document.getElementById("welcome").style.display = "none";
  document.getElementById("reader").style.display = "block";
}

let html5QrcodeScanner = new Html5QrcodeScanner("reader", {
  fps: 10,
  qrbox: 250,
});
html5QrcodeScanner.render(onScanSuccess);
