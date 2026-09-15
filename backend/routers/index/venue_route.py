from typing import Any

from backend.dependencies import VENUE_ROUTE_KEY, get_i18n

DEFAULT_ZOOM = 15


def venue_route(lang: str, default_lang: str) -> dict[str, Any] | None:
    """Build the route for ``lang``, falling back to ``default_lang``.

    Reads ``venue_route.json``, cached from the Drive i18n folder alongside the
    language files. Returns ``None`` when the document has no wording for either
    language, so the caller can skip the section entirely rather than render an
    unlabelled map.
    """
    doc = get_i18n().get(VENUE_ROUTE_KEY) or {}
    by_lang = doc.get("text") or {}
    text = by_lang.get(lang) or by_lang.get(default_lang)
    if not text:
        return None

    places = [
        {**coords, **wording}
        for coords, wording in zip(doc["places"], text["places"], strict=False)
    ]
    leg_paths = doc.get("leg_paths") or {}
    legs: list[dict[str, Any]] = []
    for i, (mode, label) in enumerate(
        zip(doc["leg_modes"], text["legs"], strict=False)
    ):
        leg: dict[str, Any] = {"mode": mode, "label": label}
        path = leg_paths.get(str(i))
        if path:
            # GeoJSON wants [lng, lat]; the document reads lat-first to match
            # `places` and the coordinates Google Maps hands you.
            leg["path"] = [[lng, lat] for lat, lng in path]
        legs.append(leg)
    pois = [
        {**poi, "label": text["pois"].get(poi["kind"], "")}
        for poi in doc.get("pois", [])
    ]
    return {
        "link_label": text["link_label"],
        "zoom": doc.get("zoom", DEFAULT_ZOOM),
        "places": places,
        "legs": legs,
        "pois": pois,
        "gesture_hints": text["gesture_hints"],
        "fullscreen": text["fullscreen"],
    }
