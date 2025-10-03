console.log("script.js loaded successfully!");

let navStack = [0];

window.navigateTo = function(level) { console.log("Navigating to level:", level); const current = document.querySelector(".nav-level.active"); if (current) current.classList.remove("active");

const target = document.querySelector('[data-level="' + level + '"]');
if (target) {
    target.classList.add("active");
    navStack.push(level);
}
};

window.closeModal = function() { console.log("Closing modal - returning to main screen");

document.querySelectorAll('.nav-level').forEach(function(level) {
    if (level.getAttribute("data-level") !== "0") {
        level.classList.remove("active");
    }
});

const mainScreen = document.querySelector('[data-level="0"]');
if (mainScreen) {
    mainScreen.classList.add("active");
}

navStack = [0];
};

window.navigateBack = function() { if (navStack.length > 1) { navStack.pop(); const current = document.querySelector(".nav-level.active"); if (current) current.classList.remove("active");

    const prevLevel = navStack[navStack.length - 1];
    const prevElement = document.querySelector('[data-level="' + prevLevel + '"]');
    if (prevElement) prevElement.classList.add("active");
}
};

document.addEventListener("DOMContentLoaded", function() { document.querySelectorAll(".nav-level").forEach(function(level) { if (level.getAttribute("data-level") !== "0") { level.classList.remove("active"); } }); });
