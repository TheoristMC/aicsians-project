const API_URL =
  "https://script.google.com/macros/s/AKfycbxvOYyo6PKGLxmkezNWGhkgn8uba9sHxv5_4EZ3-NfKF3GYmEnu94MVxwcAC7tOHYY-/exec";

const INFO_ELEM_IDS = {
  ["Student Name"]: "student-name",
  ["Student Number"]: "student-id",
  ["Learner's Reference Number"]: "student-lrn",
  ["Phone Number"]: "student-tel",
  ["Guardian's Name"]: "student-guardian",
  ["Guardian's Phone Number"]: "student-guardian-tel",
  ["Home Address"]: "student-address",
};

/**
 * Toggles the visibility of an element.
 * @param {HTMLElement} elem
 * @param {boolean} visible
 */
function toggleVisibility(elem, visible) {
  elem.style.display = visible ? "inline-block" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
  /** @type {HTMLFormElement} */
  const searchForm = document.getElementById("search-container");
  /** @type {HTMLParagraphElement} */
  const errorMessage = document.getElementById("error-message");
  /** @type {HTMLDivElement} */
  const qrContainer = document.getElementById("qr-code");
  /** @type {HTMLButtonElement} */
  const qrDownloadButton = document.getElementById("qr-code-button-download");

  /** @type {HTMLButtonElement} */
  const scanQRButton = document.getElementById("scan-qr");
  scanQRButton.onclick = setUpReader;

  /**
   * @type {typeof import("html5-qrcode").Html5Qrcode}
   */
  const Html5Qrcode = window.Html5Qrcode;
  const qrReader = new Html5Qrcode("qr-reader", {
    formatsToSupport: [0], // Zero means only support QR codes.
  });

  let isSearching = false;

  /** @type {QRCode} */
  let qr;

  /**
   * Generates a QR code from an ID.
   * @param {string} id
   */
  function generateQR(id) {
    if (qr) {
      qr.clear();
      qr.makeCode(id);
    } else {
      qr = new QRCode(qrContainer, { text: id });
    }
  }

  /**
   * Creates an <a> element and downloads the generated QR.
   * @param {string} id
   */
  function downloadQR(id) {
    const canvas = qrContainer.querySelector("canvas");
    const img = qrContainer.querySelector("img");

    // Check if there is a canvas, then get that first.
    // If there isn't, then get the image.
    // If there's nothing, return.
    const dataUrl = canvas
      ? canvas.toDataURL("image/png")
      : img && img.src
        ? img.src
        : null;
    if (!dataUrl) return;

    const loader = document.createElement("a");
    loader.href = dataUrl;
    loader.download = `student-${id}.png`;
    document.body.appendChild(loader);
    loader.click();
    document.body.removeChild(loader);
  }

  /**
   * Sets up the QR code reader.
   */
  function setUpReader() {
    /** @type {HTMLInputElement} */
    const searchBar = document.getElementById("search");

    qrReader
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 156, height: 156 } },
        async (decodedText) => {
          searchBar.value = decodedText;
          await qrReader.stop();
          qrReader.clear();
        },
        null,
      )
      .catch((err) => console.error("Camera failed to start:", err));
  }

  /**
   * Handles the search process.
   * @param {FormData} data
   */
  async function search(data) {
    const query = data.get("search");
    if (typeof query !== "string" || isSearching) return;

    toggleVisibility(errorMessage, false);

    // Return if its less than 6 since thats invalid or if the query is not all numbers.
    if (query.length < 6 || query.length > 6 || !/^\d+$/.test(query)) {
      toggleVisibility(errorMessage, true);
      errorMessage.textContent = "Invalid ID.";
      return;
    }

    isSearching = true;

    try {
      const res = await fetch(`${API_URL}?id=${encodeURIComponent(query)}`);

      /** @type {{found: boolean, content: Record<string, string>}} */
      const resData = await res.json();

      if (resData.found) {
        Object.entries(resData.content).forEach(([k, v]) => {
          const elemId = INFO_ELEM_IDS[k];
          if (typeof elemId !== "string") return;

          /** @type {null | HTMLParagraphElement} */
          const elem = document.getElementById(elemId);

          if (elemId === "student-id") {
            generateQR(v);
            qrDownloadButton.onclick = () => downloadQR(v);
          }

          // Only run if the element exist and the value isn't nothing.
          if (elem && v.length > 0) {
            elem.textContent = v;
          }
        });
      } else {
        toggleVisibility(errorMessage, true);
        errorMessage.textContent = "Unrecognized ID.";
      }
    } catch (err) {
      console.error("Something went wrong: ", err);
    } finally {
      isSearching = false;
    }
  }

  searchForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const data = new FormData(ev.target);
    await search(data);
  });
});
