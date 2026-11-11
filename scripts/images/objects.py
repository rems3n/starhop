"""The objects the gallery should cover: (image key, TargetRef(s), English Wikipedia article)."""

BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]
BODY_ARTICLE = {"Mercury": "Mercury (planet)"}

SHOWPIECE_M = [1, 8, 13, 16, 17, 20, 27, 31, 33, 42, 44, 45, 51, 57, 63, 64, 81, 82, 83, 87, 97, 101, 104]

NON_MESSIER = [
    "NGC869", "NGC884", "NGC7000", "NGC6960", "NGC6992", "NGC7293", "NGC2237", "NGC2264", "NGC2024",
    "IC434", "NGC1499", "IC1805", "IC1848", "NGC281", "NGC457", "NGC6543", "NGC2392", "NGC3242",
    "NGC7009", "NGC7662", "NGC891", "NGC4565", "NGC4631", "NGC253", "NGC5128", "NGC5139", "NGC104",
    "NGC4755", "NGC3372", "NGC2070", "LMC", "SMC", "NGC1365", "NGC6946", "NGC7331", "NGC2403",
    "NGC6752", "NGC3532", "NGC6744",
]
DSO_ARTICLE = {
    "LMC": "Large Magellanic Cloud", "SMC": "Small Magellanic Cloud",
    "NGC869": "Double Cluster", "NGC884": "Double Cluster", "NGC2237": "Rosette Nebula",
    "NGC6960": "Veil Nebula", "NGC6992": "Veil Nebula", "IC434": "Horsehead Nebula",
    "NGC7000": "North America Nebula", "NGC2024": "Flame Nebula", "NGC1499": "California Nebula",
    "IC1805": "Heart Nebula", "IC1848": "Westerhout 5",
}
STARS = ["Betelgeuse", "Sirius", "Albireo", "Mizar", "Polaris", "Antares", "Vega", "Fomalhaut", "Mira", "Algol"]


def all_objects():
    """Yield (key, ref, article)."""
    for b in BODIES:
        yield b, f"body:{b}", BODY_ARTICLE.get(b, b)
    for n in range(1, 111):
        yield f"M{n}", f"dso:M{n}", f"Messier {n}"
    for k in NON_MESSIER:
        art = DSO_ARTICLE.get(k) or (k[:3] + " " + k[3:] if k.startswith("NGC") else k[:2] + " " + k[2:])
        yield k, f"dso:{k}", art
    for s in STARS:
        yield s, f"star:{s}", s
