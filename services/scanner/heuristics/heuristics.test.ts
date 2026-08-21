import assert from "node:assert/strict";
import test from "node:test";
import {
  detectBrokenImages,
  detectConsoleErrors,
  detectInconsistentSpacingAndSizing,
  detectPlaceholderText,
  detectUnwiredForms,
} from "./index.js";

test("each AI-tell heuristic detects its own failure mode", () => {
  assert.equal(detectPlaceholderText("<main>Lorem ipsum dolor sit amet</main>").length, 1);
  assert.equal(detectBrokenImages('<img id="hero" src="">', [], "https://example.com").length, 1);
  assert.equal(detectUnwiredForms('<form id="contact"><input name="email"></form>').length, 1);
  assert.equal(detectConsoleErrors([{ type: "pageerror", message: "boom", location: "app.js:1" }]).length, 1);
  assert.equal(detectInconsistentSpacingAndSizing(`
    <div id="cards">
      <article style="padding: 8px"></article>
      <article style="padding: 11px"></article>
      <article style="padding: 13px"></article>
      <article style="padding: 8px"></article>
    </div>
  `).length, 1);
});

test("healthy markup does not trigger the form and image checks", () => {
  const html = '<form action="/contact"><img src="/hero.webp" alt="Team"><button type="submit">Send</button></form>';
  assert.equal(detectBrokenImages(html, [], "https://example.com").length, 0);
  assert.equal(detectUnwiredForms(html).length, 0);
});
