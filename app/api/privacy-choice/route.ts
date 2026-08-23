const COOKIE_NAME = "abags-external-content";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function redirectHome(request: Request, cookie: string) {
  const location = new URL("/", request.url).toString();
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      "Set-Cookie": cookie,
    },
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const choice = String(formData.get("choice") ?? "");

  if (choice !== "essential" && choice !== "external") {
    return Response.json({ error: "Nieprawidłowy wybór prywatności." }, { status: 400 });
  }

  const value = choice === "external" ? "accepted" : "rejected";
  return redirectHome(
    request,
    `${COOKIE_NAME}=${value}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax; Secure`,
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("reset") !== "1") {
    return Response.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  return redirectHome(
    request,
    `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; Secure`,
  );
}
