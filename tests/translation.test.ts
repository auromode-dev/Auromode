import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/translate/route";
import { languages } from "../lib/languages";
import { loadDictionary, translateStored } from "../lib/stored-translations";

test("stored dictionaries cover the same phrases and preserve template parameters", async () => {
  const reference = await loadDictionary("fr");
  for (const language of languages.filter((l) => l.code !== "en")) {
    const dictionary = await loadDictionary(language.code);
    assert.deepEqual(
      Object.keys(dictionary).sort(),
      Object.keys(reference).sort(),
      language.code,
    );
    for (const [source, target] of Object.entries(dictionary)) {
      assert.ok(target.trim(), source);
      assert.ok(!target.includes("\uFFFD"), source);
      assert.deepEqual(
        target.match(/\{[a-zA-Z]+\}/g)?.sort() ?? [],
        source.match(/\{[a-zA-Z]+\}/g)?.sort() ?? [],
        source,
      );
    }
    assert.notEqual(
      translateStored("Book now", dictionary),
      "Book now",
      language.code,
    );
    assert.equal(
      translateStored("Unpublished room terms, do not guess.", dictionary),
      "Unpublished room terms, do not guess.",
    );
  }
});

test("numeric templates preserve actual rates, guest counts and gallery indices", async () => {
  const dictionary = await loadDictionary("fr");
  assert.equal(
    translateStored("  3 rooms available  ", dictionary),
    "Chambres disponibles : 3",
  );
  assert.equal(
    translateStored("From ₹2,500 / night", dictionary),
    "À partir de ₹2,500 / nuit",
  );
  assert.equal(
    translateStored("Twin Room - photo 12", dictionary),
    "Chambre à deux lits - photo 12",
  );
  assert.equal(
    translateStored("2 room(s) for 3 guests", dictionary),
    "2 chambre(s) pour 3 voyageur(s)",
  );
  assert.equal(
    translateStored("From ₹<script> / night", dictionary),
    "From ₹<script> / night",
  );
  assert.equal(translateStored("__proto__", dictionary), "__proto__");
  assert.equal(translateStored("constructor", dictionary), "constructor");
  assert.equal(
    translateStored("Private Guest Name", dictionary),
    "Private Guest Name",
  );
});

test("compatibility endpoint is bounded, validates origins and never contacts a provider", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("No network allowed");
  });
  const request = (body: unknown, origin = "http://localhost") =>
    new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify(body),
    });
  assert.deepEqual(
    await (
      await POST(
        request({ language: "fr", texts: ["Book now", "Unknown text"] }),
      )
    ).json(),
    { translations: ["Réserver maintenant", "Unknown text"] },
  );
  assert.deepEqual(
    await (await POST(request({ language: "en", texts: ["Book now"] }))).json(),
    { translations: ["Book now"] },
  );
  assert.equal(
    (await POST(request({ language: "invalid", texts: ["Book now"] }))).status,
    400,
  );
  assert.equal(
    (
      await POST(
        request(
          { language: "fr", texts: ["Book now"] },
          "https://other.example",
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (await POST(request({ language: "fr", texts: [] }))).status,
    400,
  );
  assert.equal(
    (await POST(request({ language: "fr", texts: [42] }))).status,
    400,
  );
  assert.equal(
    (await POST(request({ language: "fr", texts: ["x".repeat(3001)] }))).status,
    400,
  );
  assert.equal(
    (await POST(request({ language: "fr", texts: Array(101).fill("text") })))
      .status,
    400,
  );
  assert.equal(
    (
      await POST(
        request({ language: "fr", texts: Array(4).fill("x".repeat(2600)) }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await POST(request({ language: "fr", texts: ["x".repeat(31000)] })))
      .status,
    413,
  );
});
