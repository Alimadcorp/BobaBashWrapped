// Welcome message
console.log("Welcome to Boba Bash! 🧋");

// Show a message when someone clicks the Explore button
const exploreButton = document.querySelector(".btn");

if (exploreButton) {
    exploreButton.addEventListener("click", function () {
        console.log("Let's explore our boba flavors!");
    });
}

// Check the login form
const loginForm = document.querySelector(".login-box form");

if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const email = document.querySelector("#email").value;
        const password = document.querySelector("#password").value;

        if (email === "" || password === "") {
            alert("Please fill in both fields!");
        } else {
            alert("Login design works! Real account login is not connected yet.");
        }
    });
}

// Create account message
const signupLink = document.querySelector(".signup a");

if (signupLink) {
    signupLink.addEventListener("click", function (event) {
        event.preventDefault();
        alert("Sign-up is coming soon!");
    });
}