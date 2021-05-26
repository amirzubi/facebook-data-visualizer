let UserID; // Facebook User ID
let accessToken; // Access Token
let act_id; // Ad Account ID


// Filter auswählen (Week,Month,Year)
const filter = document.getElementById('filter')

// Optionen für den Chart (Wechseln: https://apexcharts.com/docs/)
var options = {
  chart: {
    height: 350,
    type: 'area',
    curve: 'smooth',
  },
  dataLabels: {
    enabled: false
  },
  series: [],
  title: {
    text: 'Amount Spent',
  },
  noData: {
    text: 'Please use a filter to get data.'
  },
  markers: {
    size: 5,
    colors: ["#544cf2"],
    strokeColor: "#544cf2",
    strokeWidth: 3
  }
}

// Chart erstellen (Mit den definierten Optionen aus der Variable "options") und mit der index.html verbinden
var chart = new ApexCharts(
  document.querySelector("#chart"),
  options
);

// Chart Laden
chart.render();

// Integration von Facebook mit der zu verknüpfenden App ID
window.fbAsyncInit = function () {
  console.log();
  FB.init({
    appId: '1038413933267656',
    autoLogAppEvents: true,
    xfbml: true,
    version: 'v9.0'
  });
  // Integration von Facebook Login
  FB.login(function (response) {
    UserID = response.authResponse.userID;
    if (response.authResponse) {
      // Antwort von Facebook wenn es funtkioniert hat
      console.log('Herzlich willkommen!  Du wurdest erfolgreich eingeloggt. ');

      FB.api('/me/adaccounts', function (response) {
        // 1. https://developers.facebook.com/tools/explorer/?method=GET&path=me%2Fadaccounts&version=v9.0
        // 2. Rechte vergeben
        // 3. Gewünschter Ad Account auswählen, welcher die Date enthält
        // 4. Nummer dann anpassen
        act_id = response.data[3].id
        getData(act_id);
      });
    }
    // wenn das Login fehlschlägt
    else {
      console.log('Benutzer hat die Anmeldung abgebrochen oder ist nicht vollständig autorisiert.');
    }
  });

  // Für jeden Request einen Token bekommen
  FB.getLoginStatus(function (response) {
    if (response.status === 'connected') {
      // Speichern des Zugriffstokens in accessToken, mit dem wir eine Datenanforderung an den Facebook-Server stellen
      accessToken = response.authResponse.accessToken;
    }
  });

  // Daten vom Ad Account bekommen
  const getData = async (actid) => {
    // Anfrage an den Server stellen, um Klicks, Impressionen, Ausgaben, Kontowährung usw. abzurufen
    // Der "await"-Ausdruck lässt async-Funktionen pausieren, bis ein Promise erfüllt ist
    const response = await fetch(`https://graph.facebook.com/v9.0/${actid}/insights?fields=impressions,clicks,spend,account_currency&access_token=${accessToken}`);
    // Nach der Anfrage an die Server erhalten wir die geforderten Daten von Facebook und speichern diese in data 
    const data = await response.json()
    // Aus dem Datenobjekt erhalten wir nur die folgenden Werte --> Impressionen, Klicks, Ausgaben, Kontowährung
    const { impressions, clicks, spend, account_currency } = data.data[0]
    // Umformatierung der erhaltenen Daten
    let impressionC = numberWithCommas(impressions)
    let clicksC = numberWithCommas(clicks)
    // Übertragung der Daten in die index Datei
    $('#amount').text(spend)
    $('#impression').text(impressionC)
    $('#clicks').text(clicksC)
    $('#currency').text(account_currency)
  }

  // Hilfsfunktion für die Umformatierung
  const numberWithCommas = (x) => {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Damit sich die Daten anpassen wenn der User den Dropdown verwendet
  filter.addEventListener('change', (event) => {
    // Updaten der Daten nach den gewählten Kriterien vom User
    updateData(event.target.value) //Wertübergabe an die Funktion Werte können Jahr, Monat, Woche sein

    // Abfrage des FB-Servers, um den ausgegebenen Betrag aus dem vom Benutzer ausgewählten Wert zu erhalten + Zeitraum wird immer um 1 erhöht
    FB.api(
      `/${act_id}/insights?fields=spend&date_preset=${event.target.value}&time_increment=1`,
      'GET',
      { "date_preset": `${event.target.value}` },
      response => {
        // nachdem wir die Daten erhalten haben, müssen wir das Diagramm aktualisieren.
        chart.updateOptions({
          xaxis: {
            categories: response.data.map(val => val.date_start)
          }
        })
        // Dadurch werden die Daten im Diagramm aktualisiert
        chart.updateSeries([{
          data: response.data.map(val => val.spend)
        }])

        // Wenn wir mehr als als 25 Datensätze erhalten wird es schwieriger zum auf dem Chart darzustellen darum haben wir einen Button hinzugefügt welche den nächsten Datensatz zeigt
        if (response.paging.next) {
          // hier haben wir definiert ob der Button ausgeblendet oder eingeblendet sein soll
          $('#next').css('visibility', 'visible')
          // wenn der User auf den Button drückt wird die funktion getDatafromserver ausgeführt
          $('#next').click(() => {
            // anfrage erstellen um die Daten zu erhalten
            getDataFromServer(response.paging.next)
          })
        }
      }
    );
  })

  // Funktion um die Daten abzurufen
  const getDataFromServer = (url) => {

    fetch(url)
      .then(response => response.json())
      .then(data => {

        // nachdem wir einen weiteren Datensatz erhalten haben, aktualisieren wir das Diagramm
        updateChart(data)
        // das gleiche gilt, wenn wir mehr als diese 25 Daten haben 
        if (data.paging.next) {
          $('#next').click(() => {
            getDataFromServer(data.paging.next)
          })
        } else {
          // wenn es keine Daten hat oder weniger als 25 dann wird der Button nicht angezeigt
          $('#next').css('visibility', 'hidden')
        }
      })
  }

  // Funktion zum Aktualisieren des Diagramms
  const updateChart = (data) => {
    // Dadurch werden sowohl die x- als auch die y-Achse des Diagramms aktualisiert
    chart.updateOptions({
      series: [{
        data: data.data.map(val => val.spend)
      }],
      xaxis: {
        categories: data.data.map(val => val.date_start)
      }
    })
  }

  // Funktion zum Aktualisieren der Daten oberhalb des Charts --> also amount, impressions, clicks
  const updateData = async (filterVal) => {

    FB.api(
      `/${act_id}/insights?fields=clicks,impressions,spend,account_currency`,
      'GET',
      { "date_preset": `${filterVal}` },
      response => {
        const { spend, impressions, clicks, account_currency } = response.data[0]
        // Hinzufügen von Daten zur index Datei + Umformatierung dieser
        $('#amount').text(spend.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','))
        $('#impression').text(impressions.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','))
        $('#clicks').text(clicks.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','))
        $('#currency').text(account_currency)
      }
    );
  }
};