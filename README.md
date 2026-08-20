# PESAWI 2026 — Live Scoreboard

A website for tracking live scores during **PESAWI Ke-13 (Pesta Sukan
Antara Wilayah) 2026** — Yayasan Sabah's inter-zone sports festival,
running 3–6 October 2026.

## What is this, in plain terms?

Think of it as a live scoreboard that anyone can check on their phone
or computer, no app to download. There are two sides to it:

- **The public side** — anyone can open this, no account needed. It
  shows the match schedule, live scores as they happen, and an overall
  ranking of how each zone is doing across the whole festival.
- **The admin side** — only for scorekeepers. They log in, pick a
  sport, and update scores as matches are actually played.

## Who's competing?

Five zones: **KK, Tawau, Sandakan, Lahad Datu, and Keningau.**

## What sports are covered?

Badminton, Sepak Takraw, Pickleball, Ping Pong, Bola Tampar, Futsal,
Petanque, Karom, and Dart — 9 sports in total, several of them split
into categories (like Men's/Women's, or Singles/Doubles).

## How scores actually work

Different sports are scored differently, and the app matches how each
one is really played:

- **Simple sports** (Futsal, Petanque, Karom) — just a running score,
  goes up point by point.
- **Set-based sports** (Badminton, Pickleball, Ping Pong, Sepak Takraw,
  Bola Tampar) — scored set by set, like a real match, not just one number.
- **Darts** — scored as a countdown from 501, the traditional way darts
  is played, down to exactly zero.

For Badminton, Pickleball, Ping Pong, Karom, and Dart specifically, a
match between two zones is actually made up of **5 smaller matches**
(Men's Singles, Women's Singles, Men's Doubles, Women's Doubles, Mixed
Doubles) played on the same day — whichever zone wins more of those 5
wins that overall tie, similar to how international team badminton
ties (like the Thomas Cup) are decided.

## How the overall rankings work

Every sport (and category) crowns a 1st, 2nd, and 3rd place zone. The
main standings page adds all of those up across every single sport,
like an Olympic medal table — Gold, Silver, Bronze, and a total —
ranked by gold medals first, same as how real multi-sport events are
ranked.

## Where does the data live right now?

While this is still being built and tested, match data is saved
directly in whichever browser is being used, rather than a shared
online database — meaning right now, two different people on two
different phones won't yet see each other's updates. Moving this to a
real shared online database, so everyone sees the exact same live
updates no matter what device they're on, is the next major piece of
work before this goes live for the actual event.

## Current status

Actively being built and tested — not yet live for public use. Score
updates you see while testing are safe to enter and clear at any time
until the site is announced as ready for the real event.
