var http = require("http");
var key = "59936cbc7642729f6f519c130c530bdd";
var baseUrl = "api.uwaterloo.ca";

function process (command, callback) {
  //command format should be "@uwbot <commands> <parameters>"
  /**
   * Commands accepted:
   * weather
   * help
   **/

  var args = command.split(" ");
  var response;
  switch(args[1]) {
    case "weather":
      getWeather(function (data) {
        callback(data);
      });
      break;
    case "help":
      callback("Address bot with <b>@uwbot</b> or <b>@bot</b> (command) (options) <br> \
        <b>UWBot commands:</b> <br> \
          <b>weather</b>: get the current weather in waterloo <br> \
          <b>help</b>: print this help command <br>");
      break;
    default:
      callback("Unrecognized Command!");
      break;
  }
}

function getWeather(callback) {
  var url = "/v2/weather/current.json";
  var responseStr;
  var parsedResponse;
  sendReq(url, function (response) {
    parsedResponse = JSON.parse(response);
    responseStr = "The current temperature in Waterloo is: " + parsedResponse.data.temperature_current_c + " Celsius";
    callback(responseStr);
  });
}

function sendReq(url, callback) {
  var options = {
    host: baseUrl,
    port: 80,
    path : url,
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  };
  var req = http.get(options, function(res) {

  // Buffer the body entirely for processing as a whole.
  var bodyChunks = [];
  res.on('data', function(chunk) {
    // You can process streamed parts here...
    bodyChunks.push(chunk);
  }).on('end', function() {
    var body = Buffer.concat(bodyChunks);
    callback(body);
  });
  });

  req.on('error', function(e) {
    console.log('ERROR: ' + e.message);
  });
}

module.exports.process = process;