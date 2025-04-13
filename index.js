// Configuration Constants
const CONFIG = {
  URLS: {
    RESUME: "/src/SethWoodResume.pdf",
    GITHUB: "https://github.com/seth-wood",
  },
  PATHS: {
    RESUME: "./src/asciiresume.txt",
    ABOUT: "./src/about.txt",
    PROJECTS: "./src/projects.txt",
  },
  ELEMENTS: {
    ASCII_TEXT: "asciiText",
    INSTRUCTIONS: "instructions",
    PROMPT: "prompt",
    CURSOR: "cursor",
    INPUT: "command-input",
    OUTPUT: "output",
  },
};

const KEYBOARD_CONFIG = {
  MODIFIERS: ["Meta", "Tab", "Shift", "Control", "Alt", "CapsLock"],
  NAVIGATION: [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
    "PageUp",
    "PageDown",
  ],
  SYSTEM: ["Escape", "Insert"],
  FUNCTION: Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
};

const COMMANDS = {
  "": () => "\n",
  1: () => printResume(),
  2: () => printProjects(),
  3: () => printAbout(),
  clear: () => {
    elements.ascii_text.style.display = "none";
    elements.output.innerHTML = "";
  },
  download: () => downloadResume(),
  github: () => visitGitHub(),
  help: () => {
    const helpText = [
      "<commands>\n",
      "Usage:\n",
      "1           resume",
      "2           projects",
      "3           about me",
      "download    resume in pdf",
      "github      portfolio",
      "help        this help text",
      "clear       clear the screen\n\n",
    ].join("\n");
    return helpText;
  },
};

// DOM Elements
const elements = {};

// Utility Functions
const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// Command Functions
function downloadResume() {
  const URL = window.location.href + CONFIG.URLS.RESUME;
  window.open(URL, "_blank").focus();
}

function visitGitHub() {
  window.open(CONFIG.URLS.GITHUB, "_blank").focus();
}

function printResume() {
  return fetchAndWrite(CONFIG.PATHS.RESUME, 2);
}

function printAbout() {
  return fetchAndWrite(CONFIG.PATHS.ABOUT, 5);
}

function printProjects() {
  return fetchAndWrite(CONFIG.PATHS.PROJECTS, 5);
}

// Helper Functions
function fetchAndWrite(path, delay) {
  return fetch(path)
    .then((response) => response.text())
    .then((data) => {
      writeText(elements.output, data, delay);
    })
    .catch((error) => console.error("Error fetching the text file:", error));
}

function writeText(target, content, delay = 5) {
  return new Promise((resolve) => {
    const contentArray = content.split("");
    let current = 0;

    while (current < contentArray.length) {
      ((curr) => {
        setTimeout(() => {
          target.innerHTML += contentArray[curr];
          window.scrollTo(0, document.body.scrollHeight);
          if (curr === contentArray.length - 1) resolve();
        }, delay * curr);
      })(current++);
    }
  });
}

function execute(command) {
  const cmd = command.toLowerCase();
  const commandFn = COMMANDS[cmd];

  if (commandFn) {
    return commandFn();
  }

  return `Unknown command: ${command}\n Enter 'help' to see a list of commands.`;
}

function handleKeypress(e, input, output) {
  function noInputHasFocus() {
    const elements = ["INPUT", "TEXTAREA", "BUTTON"];
    return elements.indexOf(document.activeElement.tagName) === -1;
  }

  if (!noInputHasFocus()) return;

  const ignoreKeys = [
    ...KEYBOARD_CONFIG.MODIFIERS,
    ...KEYBOARD_CONFIG.NAVIGATION,
    ...KEYBOARD_CONFIG.SYSTEM,
    ...KEYBOARD_CONFIG.FUNCTION,
  ];

  if (e.key === "Enter") {
    const command = input.innerText;
    input.innerHTML = "";
    output.innerHTML += "<br><strong>" + command + "</strong>\n<br>";
    writeText(output, execute(command)).catch((e) => console.error(e));
  } else if (e.key === "Backspace") {
    input.innerHTML = input.innerHTML.substring(0, input.innerHTML.length - 1);
  } else if (ignoreKeys.includes(e.key)) {
    e.preventDefault();
  } else {
    input.insertAdjacentText("beforeend", e.key);
  }
}

// Main Init
async function initializeTerminal() {
  // Cache DOM elements
  Object.keys(CONFIG.ELEMENTS).forEach((key) => {
    elements[key.toLowerCase()] = document.getElementById(CONFIG.ELEMENTS[key]);
  });

  const asciiArt = elements.ascii_text.innerText;
  elements.ascii_text.innerHTML = "";

  await wait(1000);
  await writeText(elements.ascii_text, asciiArt);
  await wait(500);
  await writeText(
    elements.instructions,
    `Enter a command. Type 'help' for additional commands.`
  );

  elements.prompt.prepend(">");
  elements.cursor.innerHTML = "_";

  document.addEventListener("keydown", (e) =>
    handleKeypress(e, elements.input, elements.output)
  );
}

// Initialize on DOM Content Loaded
document.addEventListener("DOMContentLoaded", initializeTerminal);
