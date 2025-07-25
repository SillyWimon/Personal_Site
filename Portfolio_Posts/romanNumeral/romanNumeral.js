const numberInput = document.getElementById("number");
const convertBtn = document.getElementById("convert-btn");
const outputDiv = document.getElementById("output");
const form = document.getElementById("numeral-form");

form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleConversion();
  });
  
  convertBtn.addEventListener('click', handleConversion);

const convertToRoman = (num) => {
    const romanMap = [
        [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
        [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];

    let result = '';
    for (let [value, numeral] of romanMap) { 
        while (num >= value) {
          result += numeral; 
          num -= value; 
        }
      }
      return result;
};

function handleConversion () {
    const value = numberInput.value.trim();
    outputDiv.classList.remove("hidden");

    if (!value) {
        outputDiv.innerText = "Please enter a valid number";
        return;
    } 

    const num = parseInt(value, 10);

    if (num < 1) {
        outputDiv.innerText = "Please enter a number greater than or equal to 1";
        } else if (num >= 4000) {
            outputDiv.innerText = "Please enter a number less than or equal to 3999";
        } else {
            outputDiv.innerText = convertToRoman(num);
            }
};

//     outputDiv.innerText = `You entered ${value}`;
//   });
  

  