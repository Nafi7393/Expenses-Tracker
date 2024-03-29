document.addEventListener("DOMContentLoaded", () => {
    const addBtn = document.getElementById("add-btn");
    const userId = parseInt(document.getElementById("user-id").value, 10);
    addBtn.addEventListener("click", addExpense);

    function addExpense() {
        const reasonInput = document.getElementById("reason");
        const amountInput = document.getElementById("amount");
        let reason = reasonInput.value.trim();
        const amount = parseFloat(amountInput.value);

        // If the reason is empty but the amount is given, assign a dummy reason
        if (reason === "" && !isNaN(amount)) {
            reason = "Not Specified";
        }

        // Validate the reason and amount to ensure they are not empty or NaN
        if (!reason || isNaN(amount)) {
            alert("Please enter valid data.");
            return;
        }

        // Include the user ID in the JSON data
        const jsonData = JSON.stringify({ reason, amount, user_id: userId });

        fetch("/add_expense", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: jsonData,
        })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                reasonInput.value = "";
                amountInput.value = "";
                // Reload the expenses after adding a new one
                    loadTodayExpenses(userId);
                    loadLast7DaysExpenses(userId);
                    loadAllMonthsExpenses(userId);
            } else {
                alert("Failed to add the expense.");
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            alert("Failed to add the expense.");
        });
    }




      // Function to add event listeners to the Last 7 Days expenses list
      function attachLast7DaysListeners() {
        // Add event listener to each date div in Last 7 Days
        const dateExpandDivs = document.querySelectorAll(".date-expand");
        dateExpandDivs.forEach((dateDiv) => {
          dateDiv.addEventListener("click", () => {
            handleLast7DaysClick(dateDiv.textContent);
          });
        });
      }


    // Function to fetch and display Today's expenses
    function loadTodayExpenses(userId) {
      fetch(`/get_today_expenses/${userId}`)
        .then((response) => response.json())
        .then((data) => {
          const todayExpensesList = document.getElementById("today-expenses-list");
          todayExpensesList.innerHTML = ""; // Clear the existing list

          data.expenses.forEach((expense) => {
            const listItem = document.createElement("li");
            listItem.textContent = `${expense.reason}: ৳${expense.amount.toFixed(2)}`;

            // Add a "Remove" button for each expense
            const removeButton = document.createElement("button");
            removeButton.textContent = "Remove";
            removeButton.className = "remove-button"; // Add the remove-button class

            // Pass the expense id, name, value, and userId to the removeExpense function
            removeButton.addEventListener("click", () =>
              removeExpense(expense.id, expense.reason, expense.amount, userId)
            );

            listItem.appendChild(removeButton);

            // Insert the new expense as the first child of the list
            todayExpensesList.insertBefore(listItem, todayExpensesList.firstChild);
          });
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }


    function removeExpense(expenseId, expenseName, expenseValue, userId) {
      // Show the confirmation dialog with the expense name and value
      const isConfirmed = confirm(`Are you sure you want to remove the expense:\n${expenseName}: $${expenseValue.toFixed(2)}?`);

      if (isConfirmed) {
        fetch(`/remove_expense/${expenseId}/${userId}`, {
          method: "DELETE",
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("Failed to remove the expense.");
            }
            // Reload the expenses after successful removal
            loadTodayExpenses(userId);
            loadLast7DaysExpenses(userId);
            loadAllMonthsExpenses(userId);
          })
          .catch((error) => {
            console.error("Error:", error);
            alert("Failed to remove the expense.");
          });
      }
    }


    function loadLast7DaysExpenses() {
      fetch(`/get_last_7_days_expenses/${userId}`)
        .then((response) => response.json())
        .then((data) => {
          const last7DaysList = document.getElementById("last-7-days-list");
          last7DaysList.innerHTML = "";

          data.expenses.forEach((expense) => {
            const date = new Date(expense.date).toLocaleDateString();
            const totalAmount = `৳${expense.totalAmount.toFixed(2)}`;

            const listItem = document.createElement("li");
            listItem.innerHTML = `
              <div class="date-expand">${date}</div>
              <div>${totalAmount}</div>
              <div class="expenses-details" id="expenses-details-${date}" style="display: none;">
                ${generateExpenseDetailsList(expense.details)}
              </div>
            `;

            last7DaysList.appendChild(listItem);
          });

          // Attach event listeners to Last 7 Days expenses list
          attachLast7DaysListeners();
          if (data.expenses.length > 0) {
              loadAndRenderWeeklyBarChart(data);
          }
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }

    function generateDateDetailsList(expenses) {
      // Create an object to store total expenses for each date
      const dateExpensesMap = {};

      expenses.forEach((expense) => {
        const date = new Date(expense.date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;

        if (dateExpensesMap.hasOwnProperty(formattedDate)) {
          dateExpensesMap[formattedDate].totalAmount += expense.amount;
        } else {
          dateExpensesMap[formattedDate] = {
            totalAmount: expense.amount,
            expenses: [],
          };
        }

        dateExpensesMap[formattedDate].expenses.push({
          reason: expense.reason,
          amount: expense.amount,
        });
      });

      // Generate the sorted dates
      const sortedDates = Object.keys(dateExpensesMap).sort((a, b) => new Date(a) - new Date(b));

      // Generate the HTML for the expenses details list
      let html = '<ul class="expense-list">';
      sortedDates.forEach((formattedDate) => {
        const data = dateExpensesMap[formattedDate];
        html += `
          <li>
            <div class="date-expand">${formattedDate} (৳${data.totalAmount.toFixed(2)})</div>
            <div class="date-expenses-details" style="display: none;">
              ${generateDailyExpenseList(data.expenses)}
            </div>
          </li>
        `;
      });
      html += '</ul>';
      return html;
    }

    function generateDailyExpenseList(expenses) {
      return expenses
        .map(
          (expense) => `
            <li>
              <span class="expense-name">${expense.reason}:</span>
              <span class="expense-amount">৳${expense.amount.toFixed(2)}</span>
            </li>
          `
        )
        .join('');
    }






    function generateExpenseDetailsList(expenses) {
      let html = '<ul class="expense-list">'; // Create an unordered list to display the expenses

      expenses.forEach((expense) => {
        // Format the amount with the currency symbol (৳) and two decimal places
        const formattedAmount = `৳${expense.amount.toFixed(2)}`;

        // Add each expense and its formatted amount to the list item with appropriate styling
        html += `
          <li>
            <span class="expense-name">${expense.reason}:</span>
            <span class="expense-amount">${formattedAmount}</span>
          </li>
        `;
      });

      html += '</ul>'; // Close the unordered list

      return html;
    }

    function attachMonthExpandListeners() {
        const allMonthsList = document.getElementById("all-months-list");
        allMonthsList.addEventListener("click", handleMonthExpandClick);
    }

    function handleMonthExpandClick(event) {
        const target = event.target;
        if (target.classList.contains("month-expand")) {
            const expensesDetails = target.nextElementSibling;
            const isVisible = expensesDetails.style.display === "block";

            // Toggle the display property based on its current state
            expensesDetails.style.display = isVisible ? "none" : "block";
        }
    }

    function attachDateExpandListeners() {
        const allMonthsList = document.getElementById("all-months-list");
        allMonthsList.addEventListener("click", handleDateExpandClick);
    }

    function handleDateExpandClick(event) {
        const target = event.target;
        if (target.classList.contains("date-expand")) {
            const expensesDetails = target.nextElementSibling;
            const isVisible = expensesDetails.style.display === "block";

            // Toggle the display property based on its current state
            expensesDetails.style.display = isVisible ? "none" : "block";
        }
    }

    function handleLast7DaysClick(date) {
        const expensesDetails = document.getElementById(`expenses-details-${date}`);
        expensesDetails.style.display = expensesDetails.style.display === "none" ? "block" : "none";
    }

    function loadAllMonthsExpenses(userId) {
        fetch(`/get_all_months_expenses/${userId}`)
            .then((response) => response.json())
            .then((data) => {
                const allMonthsList = document.getElementById("all-months-list");
                allMonthsList.innerHTML = "";

                data.expenses.forEach((monthData) => {
                    const listItem = document.createElement("li");
                    listItem.innerHTML = `
                        <div class="month-expand">${monthData.month} &rarr; <strong>৳${monthData.totalAmount.toFixed(2)}</strong></div>
                    `;
                    listItem.classList.add("clickable"); // Add the clickable class for month items

                    allMonthsList.appendChild(listItem);
                });

                // Attach event listeners to the months in the list
                attachMonthExpandListeners();
                attachDateExpandListenersMonth();
                attachMonthItemClickListeners();

                if (data.expenses.length > 0) {
                    loadAndRenderMonthlyChart(data);
                }
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    }

    function attachMonthItemClickListeners() {
        const allMonthsList = document.getElementById("all-months-list");
        allMonthsList.addEventListener("click", handleMonthItemClick);
    }




function handleMonthItemClick(event) {
    const target = event.target;
    if (target.classList.contains("month-expand")) {
        const monthHeader = document.getElementById("selected-month-header");
        const selectedMonthExpensesList = document.getElementById("selected-month-expenses-list");

        const monthName = target.textContent.trim(); // Get the month name from the target element
        const year = new Date().getFullYear(); // Get the current year

        // monthHeader.textContent = `${monthName} - Details`;
        monthHeader.innerHTML = `<strong>${monthName}</strong> - Details`;
        selectedMonthExpensesList.innerHTML = "<h3>Loading data...</h3>";

        // Fetch and display expenses for the selected month
        fetch(`/get_month_expenses/${userId}/${monthName}`)
            .then((response) => response.json())
            .then((data) => {
                selectedMonthExpensesList.innerHTML = ""; // Clear the existing list

                selectedMonthExpensesList.innerHTML = generateDateDetailsListMonth(data.expenses);
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    }
}

function generateDateDetailsListMonth(expenses) {
    // Create an object to store total expenses for each date
    const dateExpensesMap = {};

    expenses.forEach((expense) => {
        const date = new Date(expense.date).toLocaleDateString();
        const totalAmount = `৳${expense.amount.toFixed(2)}`;

        if (dateExpensesMap.hasOwnProperty(date)) {
            dateExpensesMap[date].totalAmount += expense.amount;
        } else {
            dateExpensesMap[date] = {
                totalAmount: expense.amount,
                expenses: [],
            };
        }

        dateExpensesMap[date].expenses.push({
            reason: expense.reason,
            amount: expense.amount,
        });
    });

    // Generate the sorted dates
    const sortedDates = Object.keys(dateExpensesMap).sort((a, b) => new Date(a) - new Date(b));

    // Generate the HTML for the expenses details list
    let html = '<ul class="date-list">';
    sortedDates.forEach((date) => {
        const data = dateExpensesMap[date];
        html += `
            <li>
                <div class="date-expand">${date}</div>
                <div>৳${data.totalAmount.toFixed(2)}</div>
                <div class="date-expenses-details" id=expenses-details-monthly-${date}" style="display: none;">
                    ${generateDailyExpenseListMonth(data.expenses)}
                </div>
            </li>
        `;
    });
    html += '</ul>';
    return html;
}


function generateDailyExpenseListMonth(expenses) {
    return expenses
        .map(
            (expense) => `
                <div class="expense-item">
                    <span class="expense-name">${expense.reason}:</span>
                    <span class="expense-amount">৳${expense.amount.toFixed(2)}</span>
                </div>
            `
        )
        .join('');
}


function attachDateExpandListenersMonth() {
    const selectedMonthExpensesList = document.getElementById("selected-month-expenses-list");
    selectedMonthExpensesList.addEventListener("click", handleDateExpandClickMonth);
}

function handleDateExpandClickMonth(event) {
    const target = event.target;
    if (target.classList.contains("date-expand")) {
        const expensesDetails = target.nextElementSibling.nextElementSibling;
        const isVisible = expensesDetails.style.display === "block";

        // Toggle the display property based on its current state
        expensesDetails.style.display = isVisible ? "none" : "block";
    }
}




// Function to load and render the bar chart
function loadAndRenderWeeklyBarChart(data) {
    const days = [];
    const totalAmounts = [];
    const highestAmounts = [];
    const secondHighestAmounts = [];
    const highestReasons = [];
    const secondHighestReasons = [];

    data.expenses.forEach((expense) => {
        const date = new Date(expense.date).toLocaleDateString();
        days.push(date);
        totalAmounts.push(expense.totalAmount);

        // Calculate highest and second highest expenses for each day
        const expenses = expense.details.map((detail) => detail.amount);
        expenses.sort((a, b) => b - a); // Sort in descending order
        highestAmounts.push(expenses[0] || 0); // Highest expense or 0 if no expenses
        secondHighestAmounts.push(expenses[1] || 0); // Second highest expense or 0 if no expenses

        // Get reasons for highest and second highest expenses
        const highestExpenseDetail = expense.details.find(detail => detail.amount === expenses[0]);
        highestReasons.push(highestExpenseDetail ? highestExpenseDetail.reason : "");
        const secondHighestExpenseDetail = expense.details.find(detail => detail.amount === expenses[1]);
        secondHighestReasons.push(secondHighestExpenseDetail ? secondHighestExpenseDetail.reason : "");
    });

    // Create a bar chart using Chart.js
    const ctx = document.getElementById("expensesChart").getContext("2d");
    new Chart(ctx, {
        type: "bar",
        data: {
            labels: days,
            datasets: [
                {
                    label: "Total",
                    data: totalAmounts,
                    backgroundColor: "#007bff",
                    borderColor: "rgb(0,4,255)",
                    borderWidth: 1,
                    reasons: ['', '', '', '', '', '', ''],
                },
                {
                    label: "Highest Expense",
                    data: highestAmounts,
                    backgroundColor: "#dc3545",
                    borderColor: "rgb(255,0,22)",
                    borderWidth: 1,
                    reasons: highestReasons,
                },
                {
                    label: "Second Highest",
                    data: secondHighestAmounts,
                    backgroundColor: "#ffcb00",
                    borderColor: "rgb(255,183,0)",
                    borderWidth: 1,
                    reasons: secondHighestReasons,
                },
            ],
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                },
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label;
                            const value = context.parsed.y;
                            const reason = context.dataset.reasons[context.dataIndex];
                            return `${label}: ৳${value.toFixed(2)}\n${reason}`;
                        }
                    }
                }
            }
        },
    });
}




function loadAndRenderMonthlyChart(data) {
    const months = [];
    const totalAmounts = [];
    const highestAmounts = [];
    const secondHighestAmounts = [];
    const highestDates = [];
    const secondHighestDates = [];

    data.expenses.forEach((monthData) => {
        const monthName = monthData.month;
        months.push(monthName);
        totalAmounts.push(monthData.totalAmount);

        // Find the day with the highest and second highest total expenses for the month
        const sortedDates = monthData.details
            .reduce((result, detail) => {
                const date = detail.date;
                const existing = result.find(item => item.date === date);
                if (existing) {
                    existing.totalAmount += detail.amount;
                } else {
                    result.push({ date, totalAmount: detail.amount });
                }
                return result;
            }, [])
            .sort((a, b) => b.totalAmount - a.totalAmount);

        highestAmounts.push(sortedDates[0]?.totalAmount || 0);
        secondHighestAmounts.push(sortedDates[1]?.totalAmount || 0);
        highestDates.push(sortedDates[0]?.date || "");
        secondHighestDates.push(sortedDates[1]?.date || "");
    });

    // Create a bar chart for monthly data using Chart.js
    const ctx = document.getElementById("monthlyChart").getContext("2d");
    new Chart(ctx, {
        type: "bar",
        data: {
            labels: months,
            datasets: [
                {
                    label: "Total",
                    data: totalAmounts,
                    backgroundColor: "#007bff",
                    borderColor: "rgb(0,4,255)",
                    borderWidth: 1,
                },
                {
                    label: "Highest Expense",
                    data: highestAmounts,
                    backgroundColor: "#dc3545",
                    borderColor: "rgb(255,0,22)",
                    borderWidth: 1,
                },
                {
                    label: "Second Highest",
                    data: secondHighestAmounts,
                    backgroundColor: "#ffcb00",
                    borderColor: "rgb(255,183,0)",
                    borderWidth: 1,
                },
            ],
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                },
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.dataset.label;
                            const value = context.parsed.y;
                            let date = '';

                            if (label === "Highest Expense") {
                                date = highestDates[context.dataIndex];
                            } else if (label === "Second Highest") {
                                date = secondHighestDates[context.dataIndex];
                            }

                            if (date && label !== "Total Expenses") {
                                const dateObj = new Date(date);
                                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                                date = dateObj.toLocaleDateString('en-US', options);
                            }

                            return `${label}: ৳${value.toFixed(2)}${date ? `\nDate: ${date}` : ''}`;
                        },
                    },
                },
            },
        },
    });
}









  // Load functions!
    loadTodayExpenses(userId);
    loadLast7DaysExpenses(userId);
    loadAllMonthsExpenses(userId);
});
