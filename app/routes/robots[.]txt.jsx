export const loader = () => {
  return new Response("User-agent: *\nDisallow: /\n", {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
