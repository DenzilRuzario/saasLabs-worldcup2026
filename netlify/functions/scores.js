exports.handler = async function (event, context) {
  const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
  const { endpoint } = event.queryStringParameters || {};

  const BASE_URL = "https://api.football-data.org/v4";

  const endpointMap = {
    today: `${BASE_URL}/competitions/WC/matches?status=SCHEDULED,LIVE,IN_PLAY,PAUSED,FINISHED&dateFrom=${getToday()}&dateTo=${getToday()}`,
    live: `${BASE_URL}/competitions/WC/matches?status=LIVE,IN_PLAY,PAUSED`,
    recent: `${BASE_URL}/competitions/WC/matches?status=FINISHED&limit=6`,
    upcoming: `${BASE_URL}/competitions/WC/matches?status=SCHEDULED&limit=6`,
    allmatches: `${BASE_URL}/competitions/WC/matches`,
    standings: `${BASE_URL}/competitions/WC/standings`,
  };

  const url = endpointMap[endpoint] || endpointMap["today"];

  try {
    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: errorText }),
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}
