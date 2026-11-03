export function GET() {
  return new Response("2000000000", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
