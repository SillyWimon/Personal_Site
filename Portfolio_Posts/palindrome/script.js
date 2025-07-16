const input = document.getElementById("text-input");
const resultDiv = document.getElementById("result");
const checkBtn = document.getElementById("check-btn");
const form = document.getElementById("palindrome-form");



function checkPalindrome() {
  const inputText = input.value;
  const cleanedText = inputText.toLowerCase().replace(/[^a-z0-9]/g, "");
  const reversedText = cleanedText.split("").reverse().join("");

  if (!cleanedText) {
    alert("Please input a value");
    return; // Prevents the rest of the function from running
  } else if (cleanedText === reversedText) {
    resultDiv.innerText = `"${inputText}" is a palindrome!`;
  } else {
    resultDiv.innerText = `"${inputText}" is not a palindrome.`;
  }

  resultDiv.classList.remove("hidden");
}

checkBtn.addEventListener("click", checkPalindrome);

form.addEventListener("submit", function(event) {
    event.preventDefault(); // prevent page reload
    checkPalindrome(); // call your function
  });
