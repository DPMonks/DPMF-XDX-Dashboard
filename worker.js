export default {
  async fetch(request) {
    try {
      const target = "https://s2.ripple.com:51234";

      // Read the incoming JSON body
      const reqBody = await request.text();

      // Forward the request to XRPL
      const upstream = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: reqBody
      });

      // Read upstream response as text
      const text = await upstream.text();

      // Return clean JSON back to the caller
      return new Response(text, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/json"
        }
      });

    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500 }
      );
    }
  }
};
