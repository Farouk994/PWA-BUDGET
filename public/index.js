let transactions = [];
let arr = [];
let myChart;


//Open IndexedDb
const request = window.indexedDB.open("expenses", 1);
//On error
request.onerror = function (event) {
  console.log("Could not open IndexedDb");
};
//On success
request.onsuccess = function (event) {
  updaloadSavedRecords();
};
//Create object store
request.onupgradeneeded = function (event) {
  var db = event.target.result;
  db.createObjectStore("expenses", { keyPath: 'key', autoIncrement: true });
};

function getData() {
  fetch("/api/transaction")
    .then(response => {
      return response.json();
    })
    .then(data => {
      // save db data on global variable
      transactions = data;
      arr = [...transactions];
      // transactions.unshift(getSavedRecords());
      populateTotal();
      populateTable();
      populateChart();
    });
}

getData();

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: "Total Over Time",
        fill: true,
        backgroundColor: "#6666ff",
        data
      }]
    }
  });
}

function sendTransaction(isAdding) {

  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();

  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  }).then(response => {
    //Attempt to upload previously saved records
    updaloadSavedRecords();
    return response.json();
  }).then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  }).catch(err => {
    // fetch failed, so save in indexed db
    saveRecord(transaction);

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

document.querySelector("#add-btn").onclick = function () {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function () {
  sendTransaction(false);
};

//Add records to IndexedDb if offline
function saveRecord(transaction) {
  const db = request.result;
  const IndexedDbTransation = db.transaction(["expenses"], "readwrite");
  savedTransactions = IndexedDbTransation.objectStore("expenses");
  savedTransactions.add(transaction);
}

//Upload records from IndexedDb
function updaloadSavedRecords() {
  const db = request.result;
  const IndexedDbTransation = db.transaction(["expenses"], "readwrite");
  var savedTransactions = IndexedDbTransation.objectStore("expenses");
  var list = savedTransactions.getAll();

  //Get values from IndexedDb
  list.onsuccess = function () {
    var res = list.result;
    if(res.length==0) return;
    //Try sending bulk update
    fetch("/api/transaction/bulk", {
      method: "POST",
      body: JSON.stringify(res),
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json"
      }
    }).then(response => {
      if (response.status == 200) {
        clearIndexedDb();
        getData();
      }
    }).catch(err => {
      console.log("No connection, could not upload transactions.")
      //Load values to UI
      transactions = [...arr];
      res.forEach(e => {
        transactions.unshift(e);
      })
      populateTotal();
      populateTable();
      populateChart();
    });
  }
}

//Remove uploaded items
function clearIndexedDb() {
  const db = request.result;
  const IndexedDbTransation = db.transaction(["expenses"], "readwrite");
  savedTransactions = IndexedDbTransation.objectStore("expenses");
  savedTransactions.clear();
}