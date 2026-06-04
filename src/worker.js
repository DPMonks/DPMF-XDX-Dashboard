export default {
  async fetch(request) {
    const target = "https://s2.ripple.com:51234";

    const init = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*"
      },
      body: await request.text()
    };

    const response = await fetch(target, init);

    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": "application/json" }
    });
  }
};
