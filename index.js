// Add a specified delay in milliseconds
const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// Write text to a target element with a specified delay in ms
function writeText(target, content, delay = 5) {
  // Loop through array of content characters
  return new Promise((resolve) => {
    // Make an array of the specified content
    const contentArray = content.split("");

    // Keep track of the character currently being written
    let current = 0;

    while (current < contentArray.length) {
      ((curr) => {
        setTimeout(() => {
          target.innerHTML += contentArray[curr];
          // Scroll to the bottom of the screen unless scroll is false
          window.scrollTo(0, document.body.scrollHeight);

          // Resolve the promise once the last character is written
          if (curr === contentArray.length - 1) resolve();
        }, delay * curr); // increase delay with each iteration
      })(current++);
    }
  });
}

// Handle keypress on the document, printing them to an
// 'input' span. Input content will be interpreted as a
// command and output will be written to an output element

function handleKeypress(e, input, output) {
  // Check if a certain type of element has focus that we do not
  // want to do keypress handling on (such as form inputs)

  function noInputHasFocus() {
    const elements = ["INPUT", "TEXTAREA", "BUTTON"];
    return elements.indexOf(document.activeElement.tagName) === -1;
  }

  if (noInputHasFocus) {
    // List keys to ignore
    const ignoreKeys = [
      "Meta",
      "Tab",
      "Shift",
      "Control",
      "Alt",
      "CapsLock",
      "Escape",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Insert",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12",
    ];

    // Enter clears the input and executes the command
    if (e.key === "Enter") {
      const command = input.innerText;
      input.innerHTML = "";
      // reprint the entered command
      output.innerHTML += "<br><strong>" + command + "</strong>\n<br>";
      writeText(output, execute(command)).catch((e) => console.error(e));
    }
    // Backspace causes last character to be erased
    else if (e.key === "Backspace") {
      input.innerHTML = input.innerHTML.substring(
        0,
        input.innerHTML.length - 1,
      );
    } else if (ignoreKeys.includes(e.key)) {
      e.preventDefault();
    }
    // For any other key, print the keystroke to the prompt
    else input.insertAdjacentText("beforeend", e.key);
  }

  // Accept a command, execute it, and return any output
  function execute(command) {
    switch (command.toLowerCase()) {
      case "":
        return `\n`;

      case "1":
        printResume();
        break;

      case "2":
        //todo create html hyperlinks
        printProjects();
        break;

      case "3":
        printAbout();
        break;

      case "clear":
        asciiText.style.display = "none";
        output.innerHTML = "";
        break;

      case "download":
        downloadResume();
        break;

      case "github":
        visitGitHub();
        break;

      case "help":
        return `<commands>\n
Usage:\n
1           resume
2           projects
3           about me
download    resume in pdf
github      portfolio      
help        this help text
clear       clear the screen\n\n`;
        break;

      default:
        return `Unknown command: ${command}\n Enter 'help' to see a list of commands.`;
    }
  }
}

// Execute page loading asynchronously once content has loaded
document.addEventListener("DOMContentLoaded", async () => {
  const asciiText = document.getElementById("asciiText");
  // Store the content of asciiText, then empty it
  const asciiArt = asciiText.innerText;
  asciiText.innerHTML = "";

  const instructions = document.getElementById("instructions");
  const prompt = document.getElementById("prompt");
  const cursor = document.getElementById("cursor");

  await wait(1000);
  await writeText(asciiText, asciiArt);
  await wait(500);
  await writeText(
    instructions,
    `Enter a command. Type 'help' for additional commands.`,
  );
  prompt.prepend(">");
  cursor.innerHTML = "_";

  const input = document.getElementById("command-input");
  const output = document.getElementById("output");
  document.addEventListener("keydown", (e) => handleKeypress(e, input, output));
});

// Command Prompt Functions
function downloadResume() {
  const URL = window.location.href + "/src/SethWoodResume.pdf";
  window.open(URL, "_blank").focus();
}

// Prints ASCII Resume
function printResume() {
  fetch("./src/asciiresume.txt")
    .then((response) => response.text())
    .then((data) => {
      writeText(output, data, 2);
    })
    .catch((error) => console.error("Error fetching the text file:", error));
}

function printAbout() {
  fetch("./src/about.txt")
    .then((response) => response.text())
    .then((data) => {
      writeText(output, data, 5);
    })
    .catch((error) => console.error("Error fetching the text file:", error));
}

function printProjects() {
  fetch("./src/projects.txt")
    .then((response) => response.text())
    .then((data) => {
      writeText(output, data, 5);
    })
    .catch((error) => console.error("Error fetching the text file:", error));
}

function visitGitHub() {
  const URL = "https://github.com/seth-wood";
  window.open(URL, "_blank").focus();
}
