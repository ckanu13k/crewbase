import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const lang = form.get("lang") === "es" ? "es" : "en";
  const back = String(form.get("back") ?? "/");
  const res = NextResponse.redirect(new URL(back.startsWith("/") ? back : "/", req.url), 303);
  res.cookies.set("cp_lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
