/* ==========================================================================
   Hayl — app.js
   Sections: config, menu data + rendering, live ticket animation,
   booking form + webhook, scripted chat ordering, scroll reveal.
   ========================================================================== */

"use strict";

/* ============================ CONFIG ============================ */

// >>> PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE <<<
// Leave as-is for the demo: the UI works fully without a backend.
const BOOKING_WEBHOOK_URL = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";

// Single flag so every part of the script can respect reduced motion.
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============================ MENU ============================ */

// Single source of truth for the menu; the chat bot reuses it too.
const MENU_ITEMS = [
  { name: "Flat White",        price: 4.5,  category: "hot",    description: "Double ristretto with velvety micro-foam. Our benchmark cup." },
  { name: "V60 Pour Over",     price: 5.25, category: "hot",    description: "Single-origin Ethiopian, floral and bright. Brewed to order." },
  { name: "Spanish Latte",     price: 5.0,  category: "hot",    description: "Espresso, condensed milk, and a whisper of cinnamon." },
  { name: "Saffron Cortado",   price: 5.5,  category: "hot",    description: "House signature — cortado infused with real saffron threads." },
  { name: "Iced Pistachio Latte", price: 5.75, category: "cold", description: "Cold espresso over pistachio milk. Dangerously smooth." },
  { name: "Cold Brew Tonic",   price: 5.25, category: "cold",   description: "18-hour cold brew, tonic water, orange zest. Sparkling and bitter-sweet." },
  { name: "Iced Matcha",       price: 5.0,  category: "cold",   description: "Ceremonial-grade matcha whisked over oat milk and ice." },
  { name: "Almond Croissant",  price: 3.75, category: "bakery", description: "Twice-baked, filled with frangipane, dusted generously." },
  { name: "Date & Walnut Loaf", price: 3.5, category: "bakery", description: "Warm slice with salted butter. Pairs with anything hot." },
  { name: "Saffron Bun",       price: 3.25, category: "bakery", description: "Soft brioche knot glazed with saffron syrup." },
];

const menuGrid = document.getElementById("menu-grid");
const chipButtons = document.querySelectorAll(".chip");

function renderMenu(filter = "all") {
  const items =
    filter === "all"
      ? MENU_ITEMS
      : MENU_ITEMS.filter((item) => item.category === filter);

  menuGrid.innerHTML = items
    .map(
      (item) => `
      <article class="menu-card">
        <div class="menu-card-top">
          <h3>${item.name}</h3>
          <span class="menu-price">$${item.price.toFixed(2)}</span>
        </div>
        <p class="menu-desc">${item.description}</p>
        <span class="menu-tag">${item.category}</span>
      </article>`
    )
    .join("");
}

chipButtons.forEach((chip) => {
  chip.addEventListener("click", () => {
    chipButtons.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    renderMenu(chip.dataset.filter);
  });
});

renderMenu();

/* ============================ LIVE TICKET ============================ */

// The hero's signature element: a kitchen ticket that types itself,
// pauses, wipes, and loops forever.
const TICKET_LINES = [
  "HAYL — ORDER #0042",
  "────────────────────",
  "1× Flat White        $4.50",
  "1× Almond Croissant  $3.75",
  "1× Saffron Bun       $3.25",
  "────────────────────",
  "TOTAL               $11.50",
  "Payment: Apple Pay ✓",
  "",
  "Sent to kitchen — 06:58 AM",
];

const ticketBody = document.getElementById("ticket-body");

function startTicketLoop() {
  // Reduced motion: render the full ticket once, no typing, no loop.
  if (REDUCED_MOTION) {
    ticketBody.textContent = TICKET_LINES.join("\n");
    return;
  }

  const cursor = document.createElement("span");
  cursor.className = "ticket-cursor";
  let line = 0;
  let char = 0;
  let output = "";

  function type() {
    if (line >= TICKET_LINES.length) {
      // Hold the finished ticket, then wipe and restart.
      setTimeout(() => {
        output = "";
        line = 0;
        char = 0;
        type();
      }, 3500);
      return;
    }

    const current = TICKET_LINES[line];
    if (char < current.length) {
      output += current[char];
      char++;
    } else {
      output += "\n";
      line++;
      char = 0;
    }

    ticketBody.textContent = output;
    ticketBody.appendChild(cursor);

    // Brief pause at line breaks reads more like a real printer.
    setTimeout(type, char === 0 ? 260 : 28);
  }

  type();
}

startTicketLoop();

/* ============================ BOOKING ============================ */

const bookingForm = document.getElementById("booking-form");
const bookingError = document.getElementById("bk-error");
const bookingPlaceholder = document.getElementById("booking-placeholder");
const confirmCard = document.getElementById("confirm-card");
const confirmSummary = document.getElementById("confirm-summary");
const confirmNote = document.getElementById("confirm-note");
const waMessage = document.getElementById("wa-message");

// Convert "14:30" to "2:30 PM" for a friendlier message.
function formatTime(value) {
  const [h, m] = value.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

async function sendBookingToWebhook(data) {
  // Demo-friendly: if the URL is still the placeholder, skip the network
  // call entirely so the console stays clean.
  if (BOOKING_WEBHOOK_URL.startsWith("PASTE_")) {
    return { sent: false, reason: "no webhook configured" };
  }

  try {
    // text/plain avoids the CORS preflight that Apps Script can't answer.
    await fetch(BOOKING_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    });
    return { sent: true };
  } catch (err) {
    // Never break the demo over a network problem.
    console.warn("Booking webhook failed:", err);
    return { sent: false, reason: "network error" };
  }
}

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!bookingForm.checkValidity()) {
    bookingError.hidden = false;
    return;
  }
  bookingError.hidden = true;

  const data = {
    name: document.getElementById("bk-name").value.trim(),
    guests: Number(document.getElementById("bk-guests").value),
    time: document.getElementById("bk-time").value,
    email: document.getElementById("bk-email").value.trim(),
    submittedAt: new Date().toISOString(),
  };

  const prettyTime = formatTime(data.time);
  const guestLabel = data.guests === 1 ? "1 guest" : `${data.guests} guests`;

  confirmSummary.textContent = `Table for ${guestLabel} at ${prettyTime}. A confirmation is on its way to ${data.email}.`;

  waMessage.textContent =
    `Hi ${data.name}! 👋 Your table at Hayl is confirmed:\n` +
    `• ${guestLabel}\n` +
    `• Today at ${prettyTime}\n\n` +
    `See you soon — your coffee will be ready before you arrive. ☕`;

  bookingPlaceholder.hidden = true;
  confirmCard.hidden = false;
  confirmCard.scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "nearest" });

  const result = await sendBookingToWebhook(data);
  confirmNote.textContent = result.sent
    ? "Booking synced to the reservation sheet."
    : "Demo mode: booking shown locally (no backend connected).";
});

/* ============================ CHAT ORDERING ============================ */

// Scripted flow, no AI: greet → pick items → confirm → kitchen message.
const chatLog = document.getElementById("chat-log");
const chatOptions = document.getElementById("chat-options");

// A short, curated list keeps the widget scannable on mobile.
const CHAT_MENU = MENU_ITEMS.filter((item) =>
  ["Flat White", "Saffron Cortado", "Iced Pistachio Latte", "Almond Croissant", "Saffron Bun"].includes(item.name)
);

let cart = [];

function addMessage(text, type) {
  const bubble = document.createElement("div");
  bubble.className = `msg msg-${type}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// Small delay before bot replies makes the flow feel conversational.
function botSay(text, delay = 450) {
  const wait = REDUCED_MOTION ? 0 : delay;
  setTimeout(() => addMessage(text, "bot"), wait);
}

function setOptions(options) {
  chatOptions.innerHTML = "";
  const wait = REDUCED_MOTION ? 0 : 600;
  setTimeout(() => {
    options.forEach(({ label, onPick }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-option";
      btn.textContent = label;
      btn.addEventListener("click", onPick);
      chatOptions.appendChild(btn);
    });
  }, wait);
}

function cartTotal() {
  return cart.reduce((sum, item) => sum + item.price, 0);
}

function showItemOptions() {
  const options = CHAT_MENU.map((item) => ({
    label: `${item.name} — $${item.price.toFixed(2)}`,
    onPick: () => {
      cart.push(item);
      addMessage(item.name, "user");
      botSay(`Added ${item.name}. Anything else?`);
      showItemOptions();
    },
  }));

  if (cart.length > 0) {
    options.push({
      label: `✓ Confirm order ($${cartTotal().toFixed(2)})`,
      onPick: confirmOrder,
    });
  }

  setOptions(options);
}

function confirmOrder() {
  addMessage("Confirm order", "user");

  const summary = cart.map((item) => `1× ${item.name}`).join(", ");
  botSay(`Order confirmed: ${summary}. Total: $${cartTotal().toFixed(2)}.`);

  const wait = REDUCED_MOTION ? 0 : 1200;
  setTimeout(() => {
    addMessage("⚡ Sent to kitchen automatically", "success");
  }, wait);

  setOptions([
    {
      label: "Start a new order",
      onPick: () => {
        cart = [];
        addMessage("Start a new order", "user");
        botSay("Fresh start! What can I get you?");
        showItemOptions();
      },
    },
  ]);
}

function startChat() {
  botSay("Hey! Welcome to Hayl ☕ What can I get started for you?", 200);
  showItemOptions();
}

startChat();

/* ============================ SCROLL REVEAL ============================ */

// Entrance animations via IntersectionObserver; CSS handles the transition
// and the reduced-motion override.
const revealTargets = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window && !REDUCED_MOTION) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealTargets.forEach((el) => observer.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add("is-visible"));
}
