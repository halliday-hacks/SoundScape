"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import RecordUploadPanelDark, { type UploadResult } from "./RecordUploadPanelDark";

// ─── Types ─────────────────────────────────────────────────────────────────────
type SoundType = "birds" | "traffic" | "music" | "rain" | "construction" | "insects" | "silence";

interface Pin {
  id: string | number; lat: number; lng: number; type: SoundType;
  label: string; species: string | null; intensity: number;
  db: number; time: string; ago: string; likes: number;
  listens: number; user: string; duration: string;
  location: string;
  // Set for pins loaded from Convex — enables real audio playback
  storageId?: string;
}

interface Cluster { kind: "cluster"; lat: number; lng: number; pins: Pin[]; dominantType: SoundType; }
interface Single  { kind: "single";  pin: Pin; }
type MapItem = Cluster | Single;

// ─── Config ────────────────────────────────────────────────────────────────────
const CFG: Record<SoundType, { color: string; label: string; icon: string }> = {
  birds:        { color: "#22c55e", label: "Birds",        icon: "🐦" },
  traffic:      { color: "#64748b", label: "Traffic",      icon: "🚗" },
  music:        { color: "#a855f7", label: "Music",        icon: "🎵" },
  rain:         { color: "#3b82f6", label: "Rain",         icon: "🌧️" },
  construction: { color: "#f97316", label: "Construction", icon: "🏗️" },
  insects:      { color: "#84cc16", label: "Insects",      icon: "🦋" },
  silence:      { color: "#94a3b8", label: "Silence",      icon: "🌫️" },
};

// Chill, acoustic animations — slow and gentle
const ANIM: Record<SoundType, { name: string; dur: string; timing: string }> = {
  birds:        { name: "birdFloat",    dur: "3.2s", timing: "ease-in-out" },
  traffic:      { name: "carDrift",     dur: "2.8s", timing: "ease-in-out" },
  music:        { name: "musicSway",    dur: "2.4s", timing: "ease-in-out" },
  rain:         { name: "rainDrop",     dur: "2.0s", timing: "ease-in-out" },
  construction: { name: "constNod",     dur: "2.6s", timing: "ease-in-out" },
  insects:      { name: "insectHover",  dur: "2.2s", timing: "ease-in-out" },
  silence:      { name: "silenceBreathe",dur:"4.0s", timing: "ease-in-out" },
};

// ─── Pins ──────────────────────────────────────────────────────────────────────
const PINS: Pin[] = [
  // ── Ho Chi Minh City ──
  { id:  1, lat: 10.7769, lng: 106.7009, type: "birds",        location: "Ho Chi Minh City, Vietnam",  label: "Spotted Dove",            species: "Spilopelia chinensis",       intensity: 0.72, db: 48, time: "14:23", ago: "2m ago",   likes: 14,  listens:  47, user: "Linh N.",     duration: "0:42" },
  { id:  2, lat: 10.7810, lng: 106.6950, type: "traffic",      location: "Ho Chi Minh City, Vietnam",  label: "Rush Hour Traffic",       species: null,                         intensity: 0.91, db: 76, time: "14:21", ago: "4m ago",   likes:  3,  listens:  22, user: "Minh T.",     duration: "1:15" },
  { id:  3, lat: 10.7740, lng: 106.7060, type: "music",        location: "Ho Chi Minh City, Vietnam",  label: "Street Performer",        species: null,                         intensity: 0.55, db: 61, time: "14:18", ago: "7m ago",   likes: 31,  listens:  89, user: "Hana V.",     duration: "2:03" },
  { id:  4, lat: 10.7825, lng: 106.7030, type: "rain",         location: "Ho Chi Minh City, Vietnam",  label: "Light Drizzle",           species: null,                         intensity: 0.38, db: 39, time: "14:15", ago: "10m ago",  likes:  8,  listens:  33, user: "Tran K.",     duration: "3:20" },
  { id:  5, lat: 10.7748, lng: 106.6975, type: "construction", location: "Ho Chi Minh City, Vietnam",  label: "Building Site",           species: null,                         intensity: 0.93, db: 89, time: "14:12", ago: "13m ago",  likes:  1,  listens:  18, user: "Duc N.",      duration: "0:58" },
  { id:  6, lat: 10.7760, lng: 106.7085, type: "birds",        location: "Ho Chi Minh City, Vietnam",  label: "Red-whiskered Bulbul",    species: "Pycnonotus jocosus",         intensity: 0.68, db: 52, time: "14:09", ago: "16m ago",  likes: 22,  listens:  61, user: "Phuong L.",   duration: "1:34" },
  { id:  7, lat: 10.7795, lng: 106.6990, type: "insects",      location: "Ho Chi Minh City, Vietnam",  label: "Evening Cicadas",         species: null,                         intensity: 0.61, db: 57, time: "14:06", ago: "19m ago",  likes: 17,  listens:  44, user: "Nam H.",      duration: "0:31" },
  { id:  8, lat: 10.7732, lng: 106.7040, type: "silence",      location: "Ho Chi Minh City, Vietnam",  label: "Quiet Garden",            species: null,                         intensity: 0.18, db: 28, time: "14:03", ago: "22m ago",  likes: 29,  listens:  73, user: "Mai P.",      duration: "4:12" },
  { id:  9, lat: 10.7780, lng: 106.7055, type: "birds",        location: "Ho Chi Minh City, Vietnam",  label: "Common Myna Colony",      species: "Acridotheres tristis",       intensity: 0.80, db: 64, time: "14:00", ago: "25m ago",  likes: 11,  listens:  38, user: "Bao T.",      duration: "1:07" },
  { id: 10, lat: 10.7715, lng: 106.7015, type: "traffic",      location: "Ho Chi Minh City, Vietnam",  label: "Intersection Rush",       species: null,                         intensity: 0.88, db: 82, time: "13:57", ago: "28m ago",  likes:  2,  listens:  15, user: "Khoa N.",     duration: "2:45" },
  { id: 11, lat: 10.7837, lng: 106.6868, type: "music",        location: "Ho Chi Minh City, Vietnam",  label: "Jazz Bar Ambience",       species: null,                         intensity: 0.62, db: 65, time: "21:10", ago: "1h ago",   likes: 44,  listens: 112, user: "Thu H.",      duration: "3:05" },
  { id: 12, lat: 10.7856, lng: 106.6912, type: "birds",        location: "Ho Chi Minh City, Vietnam",  label: "Tailor Bird Calls",       species: "Orthotomus sutorius",        intensity: 0.50, db: 46, time: "06:12", ago: "8h ago",   likes: 19,  listens:  55, user: "Lan P.",      duration: "0:55" },
  { id: 13, lat: 10.7322, lng: 106.7200, type: "silence",      location: "Ho Chi Minh City, Vietnam",  label: "Riverside Dawn",          species: null,                         intensity: 0.14, db: 25, time: "05:45", ago: "9h ago",   likes: 38,  listens:  96, user: "Ngoc B.",     duration: "5:00" },
  { id: 14, lat: 10.7280, lng: 106.7150, type: "birds",        location: "Ho Chi Minh City, Vietnam",  label: "Swamphen Wading",         species: "Porphyrio porphyrio",        intensity: 0.55, db: 45, time: "07:20", ago: "7h ago",   likes: 26,  listens:  74, user: "Huy D.",      duration: "1:18" },
  { id: 15, lat: 10.9800, lng: 106.6500, type: "birds",        location: "Binh Duong, Vietnam",        label: "Oriental Magpie-Robin",   species: "Copsychus saularis",         intensity: 0.73, db: 53, time: "06:30", ago: "8h ago",   likes: 40,  listens: 118, user: "Huong V.",    duration: "1:45" },
  { id: 16, lat: 10.9450, lng: 106.9200, type: "birds",        location: "Dong Nai, Vietnam",          label: "Peacock Display",         species: "Pavo cristatus",             intensity: 0.84, db: 68, time: "09:00", ago: "5h ago",   likes: 48,  listens: 132, user: "Hang N.",     duration: "2:20" },
  { id: 17, lat: 10.4800, lng: 107.1100, type: "birds",        location: "Vung Tau, Vietnam",          label: "Seabird Colony",          species: "Sterna hirundo",             intensity: 0.78, db: 67, time: "07:00", ago: "8h ago",   likes: 37,  listens: 108, user: "Binh L.",     duration: "1:55" },
  // ── Melbourne ──
  { id: 18, lat: -37.8136, lng: 144.9631, type: "birds",       location: "Melbourne, Australia",       label: "Laughing Kookaburra",     species: "Dacelo novaeguineae",        intensity: 0.88, db: 72, time: "07:15", ago: "3h ago",   likes: 94,  listens: 280, user: "Jade W.",     duration: "0:38" },
  { id: 19, lat: -37.8200, lng: 144.9550, type: "traffic",     location: "Melbourne, Australia",       label: "Flinders St Tram",        species: null,                         intensity: 0.82, db: 74, time: "08:30", ago: "2h ago",   likes: 31,  listens:  88, user: "Lachlan B.",  duration: "1:20" },
  { id: 20, lat: -37.8060, lng: 144.9700, type: "music",       location: "Melbourne, Australia",       label: "Busker on Bourke St",     species: null,                         intensity: 0.65, db: 63, time: "12:00", ago: "1h ago",   likes: 77,  listens: 199, user: "Sienna T.",   duration: "2:45" },
  { id: 21, lat: -37.8300, lng: 144.9800, type: "birds",       location: "Melbourne, Australia",       label: "Sulphur-crested Cockatoo",species: "Cacatua galerita",           intensity: 0.91, db: 78, time: "06:45", ago: "4h ago",   likes: 108, listens: 320, user: "Oliver M.",   duration: "1:05" },
  { id: 22, lat: -37.7900, lng: 144.9600, type: "birds",       location: "Melbourne, Australia",       label: "Australian Magpie Carol", species: "Gymnorhina tibicen",         intensity: 0.85, db: 66, time: "06:00", ago: "5h ago",   likes: 129, listens: 374, user: "Matilda R.",  duration: "2:10" },
  { id: 23, lat: -37.8150, lng: 145.0100, type: "rain",        location: "Carlton, Melbourne",         label: "Carlton Gardens Rain",    species: null,                         intensity: 0.60, db: 54, time: "15:00", ago: "30m ago",  likes: 44,  listens: 121, user: "Emma H.",     duration: "4:30" },
  { id: 24, lat: -37.8400, lng: 145.0200, type: "silence",     location: "South Yarra, Melbourne",     label: "Royal Botanic Dawn",      species: null,                         intensity: 0.12, db: 22, time: "05:30", ago: "6h ago",   likes: 88,  listens: 246, user: "Chloe A.",    duration: "8:00" },
  { id: 25, lat: -37.7750, lng: 145.0350, type: "insects",     location: "Fitzroy, Melbourne",         label: "Fitzroy Garden Crickets", species: null,                         intensity: 0.59, db: 55, time: "21:00", ago: "45m ago",  likes: 36,  listens:  98, user: "Noah K.",     duration: "3:15" },
  { id: 26, lat: -37.8600, lng: 144.9400, type: "construction",location: "Southbank, Melbourne",       label: "Southbank Crane Works",   species: null,                         intensity: 0.94, db: 91, time: "09:00", ago: "3h ago",   likes:  5,  listens:  19, user: "James O.",    duration: "0:55" },
  { id: 27, lat: -37.8020, lng: 145.0550, type: "birds",       location: "Collingwood, Melbourne",     label: "Rainbow Lorikeet Flock",  species: "Trichoglossus moluccanus",   intensity: 0.79, db: 69, time: "07:30", ago: "4h ago",   likes: 72,  listens: 211, user: "Ava P.",      duration: "1:30" },
  { id: 28, lat: -37.8700, lng: 145.0050, type: "birds",       location: "St Kilda, Melbourne",        label: "Tawny Frogmouth Call",    species: "Podargus strigoides",        intensity: 0.42, db: 44, time: "22:30", ago: "7h ago",   likes: 61,  listens: 178, user: "Ethan C.",    duration: "0:22" },
  { id: 29, lat: -37.7600, lng: 144.9300, type: "music",       location: "Brunswick, Melbourne",       label: "Brunswick Festival DJ",   species: null,                         intensity: 0.77, db: 82, time: "23:00", ago: "8h ago",   likes: 53,  listens: 144, user: "Zoe F.",      duration: "5:00" },
  { id: 30, lat: -37.8480, lng: 145.1150, type: "birds",       location: "Box Hill, Melbourne",        label: "Eastern Rosella",         species: "Platycercus eximius",        intensity: 0.66, db: 58, time: "08:10", ago: "3h ago",   likes: 45,  listens: 130, user: "Isla D.",     duration: "1:12" },
  { id: 31, lat: -37.8260, lng: 145.1400, type: "silence",     location: "Dandenong Ranges, Victoria", label: "Dandenong Ranges Still",  species: null,                         intensity: 0.06, db: 17, time: "11:00", ago: "1h ago",   likes: 97,  listens: 268, user: "Henry L.",    duration: "12:00" },
  { id: 32, lat: -37.9100, lng: 145.0600, type: "birds",       location: "Moorabbin, Melbourne",       label: "Willie Wagtail Dance",    species: "Rhipidura leucophrys",       intensity: 0.70, db: 57, time: "07:45", ago: "4h ago",   likes: 66,  listens: 190, user: "Lily S.",     duration: "0:48" },
  { id: 33, lat: -37.7200, lng: 144.8800, type: "insects",     location: "Sunshine, Melbourne",        label: "Dusk Bell Frogs",         species: "Litoria aurea",              intensity: 0.74, db: 63, time: "20:15", ago: "2h ago",   likes: 49,  listens: 142, user: "Charlie N.",  duration: "4:20" },
  // ── Sydney ──
  { id: 34, lat: -33.8688, lng: 151.2093, type: "birds",       location: "Sydney, Australia",          label: "Sulphur Cockatoo Mob",    species: "Cacatua galerita",           intensity: 0.90, db: 80, time: "08:00", ago: "2h ago",   likes: 82,  listens: 230, user: "Sam W.",      duration: "1:40" },
  { id: 35, lat: -33.8900, lng: 151.1900, type: "music",       location: "Sydney, Australia",          label: "Opera House Soundcheck",  species: null,                         intensity: 0.70, db: 68, time: "10:00", ago: "1h ago",   likes: 115, listens: 340, user: "Ruby J.",     duration: "3:00" },
  { id: 36, lat: -33.8600, lng: 151.2300, type: "traffic",     location: "Sydney, Australia",          label: "Harbour Bridge Rumble",   species: null,                         intensity: 0.86, db: 77, time: "07:30", ago: "3h ago",   likes: 22,  listens:  66, user: "Max T.",      duration: "2:00" },
  { id: 37, lat: -33.9150, lng: 151.2550, type: "birds",       location: "Bondi, Sydney",              label: "Currawong at Dusk",       species: "Strepera graculina",         intensity: 0.76, db: 62, time: "18:00", ago: "4h ago",   likes: 58,  listens: 164, user: "Mia G.",      duration: "0:55" },
  { id: 38, lat: -33.8300, lng: 151.2700, type: "rain",        location: "Manly, Sydney",              label: "Manly Beach Storm",       species: null,                         intensity: 0.88, db: 76, time: "14:00", ago: "5h ago",   likes: 43,  listens: 122, user: "Jack B.",     duration: "6:45" },
  // ── Cairns ──
  { id: 39, lat: -16.9186, lng: 145.7781, type: "birds",       location: "Cairns, Queensland",         label: "Cassowary Boom",          species: "Casuarius casuarius",        intensity: 0.78, db: 71, time: "06:00", ago: "9h ago",   likes: 103, listens: 305, user: "Finn O.",     duration: "0:30" },
  { id: 40, lat: -16.8700, lng: 145.7400, type: "insects",     location: "Cairns, Queensland",         label: "Rainforest Night Choir",  species: null,                         intensity: 0.82, db: 74, time: "21:30", ago: "10h ago",  likes: 78,  listens: 226, user: "Grace H.",    duration: "7:00" },
  // ── Perth ──
  { id: 41, lat: -31.9505, lng: 115.8605, type: "birds",       location: "Perth, Australia",           label: "Carnaby Cockatoo",        species: "Zanda latirostris",          intensity: 0.80, db: 67, time: "08:30", ago: "4h ago",   likes: 71,  listens: 204, user: "Freya M.",    duration: "1:10" },
  { id: 42, lat: -31.9700, lng: 115.8400, type: "silence",     location: "Perth, Australia",           label: "Kings Park at Sunrise",   species: null,                         intensity: 0.08, db: 19, time: "05:45", ago: "7h ago",   likes: 86,  listens: 240, user: "Oscar R.",    duration: "9:00" },
  { id: 43, lat: -31.9300, lng: 115.8800, type: "insects",     location: "Swan River, Perth",          label: "Swan River Crickets",     species: null,                         intensity: 0.65, db: 60, time: "19:30", ago: "3h ago",   likes: 34,  listens:  95, user: "Willow P.",   duration: "2:50" },
  // ── London ──
  { id: 44, lat:  51.5074, lng:  -0.1278, type: "birds",       location: "London, UK",                 label: "Robin in Hyde Park",      species: "Erithacus rubecula",         intensity: 0.62, db: 50, time: "07:00", ago: "5h ago",   likes: 88,  listens: 255, user: "William C.",  duration: "1:05" },
  { id: 45, lat:  51.5150, lng:  -0.0950, type: "traffic",     location: "London, UK",                 label: "Oxford St Buses",         species: null,                         intensity: 0.90, db: 84, time: "09:00", ago: "3h ago",   likes: 18,  listens:  52, user: "Sophie A.",   duration: "1:45" },
  { id: 46, lat:  51.4990, lng:  -0.1750, type: "music",       location: "Southbank, London",          label: "Busker at South Bank",    species: null,                         intensity: 0.68, db: 65, time: "14:00", ago: "2h ago",   likes: 63,  listens: 181, user: "Alfie T.",    duration: "3:20" },
  { id: 47, lat:  51.5200, lng:  -0.0800, type: "rain",        location: "Shoreditch, London",         label: "Shoreditch Rain",         species: null,                         intensity: 0.55, db: 52, time: "16:30", ago: "1h ago",   likes: 47,  listens: 134, user: "Poppy S.",    duration: "5:00" },
  // ── Paris ──
  { id: 48, lat:  48.8566, lng:   2.3522, type: "birds",       location: "Paris, France",              label: "Blackbird in Tuileries",  species: "Turdus merula",              intensity: 0.70, db: 54, time: "06:30", ago: "6h ago",   likes: 74,  listens: 212, user: "Claire M.",   duration: "1:30" },
  { id: 49, lat:  48.8730, lng:   2.3000, type: "music",       location: "Montmartre, Paris",          label: "Accordion Place du Tertre",species: null,                        intensity: 0.60, db: 61, time: "11:00", ago: "2h ago",   likes: 98,  listens: 284, user: "Hugo B.",     duration: "4:00" },
  { id: 50, lat:  48.8450, lng:   2.3700, type: "traffic",     location: "Paris, France",              label: "Boulevard Saint-Germain", species: null,                         intensity: 0.84, db: 78, time: "08:00", ago: "4h ago",   likes: 15,  listens:  44, user: "Camille D.",  duration: "2:00" },
  // ── Tokyo ──
  { id: 51, lat:  35.6762, lng: 139.6503, type: "birds",       location: "Tokyo, Japan",               label: "Japanese Bush Warbler",   species: "Horornis diphone",           intensity: 0.58, db: 48, time: "06:00", ago: "7h ago",   likes: 92,  listens: 270, user: "Haruki S.",   duration: "0:45" },
  { id: 52, lat:  35.6900, lng: 139.7000, type: "traffic",     location: "Shibuya, Tokyo",             label: "Shibuya Crossing Roar",   species: null,                         intensity: 0.96, db: 88, time: "18:00", ago: "3h ago",   likes: 67,  listens: 196, user: "Yuki T.",     duration: "1:10" },
  { id: 53, lat:  35.6580, lng: 139.7450, type: "music",       location: "Harajuku, Tokyo",            label: "Harajuku Idol Group",     species: null,                         intensity: 0.73, db: 70, time: "15:00", ago: "2h ago",   likes: 55,  listens: 162, user: "Aoi N.",      duration: "3:30" },
  { id: 54, lat:  35.7100, lng: 139.8100, type: "silence",     location: "Shinjuku, Tokyo",            label: "Shinjuku Gyoen at Dusk",  species: null,                         intensity: 0.10, db: 24, time: "17:30", ago: "1h ago",   likes: 84,  listens: 236, user: "Ren K.",      duration: "6:00" },
  { id: 55, lat:  35.6350, lng: 139.8800, type: "insects",     location: "Chiba, Japan",               label: "Summer Cicadas",          species: "Cryptotympana facialis",     intensity: 0.88, db: 82, time: "13:00", ago: "4h ago",   likes: 71,  listens: 208, user: "Mei O.",      duration: "2:20" },
  // ── Singapore ──
  { id: 56, lat:   1.3521, lng: 103.8198, type: "birds",       location: "Singapore",                  label: "Asian Koel",              species: "Eudynamys scolopaceus",      intensity: 0.82, db: 71, time: "05:30", ago: "8h ago",   likes: 61,  listens: 178, user: "Priya R.",    duration: "0:35" },
  { id: 57, lat:   1.2800, lng: 103.8500, type: "rain",        location: "Singapore",                  label: "Tropical Monsoon",        species: null,                         intensity: 0.92, db: 85, time: "15:00", ago: "2h ago",   likes: 39,  listens: 112, user: "Wei L.",      duration: "5:30" },
  { id: 58, lat:   1.3000, lng: 103.7700, type: "insects",     location: "Bukit Timah, Singapore",     label: "Bukit Timah Night",       species: null,                         intensity: 0.78, db: 69, time: "20:00", ago: "3h ago",   likes: 55,  listens: 158, user: "Selin A.",    duration: "4:00" },
  // ── New York ──
  { id: 59, lat:  40.7128, lng: -74.0060, type: "traffic",     location: "New York, USA",              label: "Manhattan Midday",        species: null,                         intensity: 0.95, db: 89, time: "12:00", ago: "1h ago",   likes: 28,  listens:  82, user: "Tyler M.",    duration: "2:30" },
  { id: 60, lat:  40.7484, lng: -73.9967, type: "music",       location: "Central Park, New York",     label: "Jazz in Central Park",    species: null,                         intensity: 0.65, db: 62, time: "14:00", ago: "3h ago",   likes: 119, listens: 346, user: "Maria S.",    duration: "6:00" },
  { id: 61, lat:  40.7282, lng: -74.0776, type: "birds",       location: "New Jersey, USA",            label: "Red-tailed Hawk",         species: "Buteo jamaicensis",          intensity: 0.54, db: 46, time: "08:00", ago: "5h ago",   likes: 76,  listens: 218, user: "Alex P.",     duration: "0:40" },
  { id: 62, lat:  40.7614, lng: -73.9776, type: "rain",        location: "Brooklyn, New York",         label: "Brooklyn Thunderstorm",   species: null,                         intensity: 0.88, db: 80, time: "17:00", ago: "4h ago",   likes: 52,  listens: 148, user: "Jasmine R.",  duration: "7:00" },
  // ── San Francisco ──
  { id: 63, lat:  37.7749, lng: -122.4194, type: "birds",      location: "San Francisco, USA",         label: "Anna's Hummingbird",      species: "Calypte anna",               intensity: 0.45, db: 40, time: "09:00", ago: "4h ago",   likes: 83,  listens: 238, user: "Casey L.",    duration: "0:28" },
  { id: 64, lat:  37.8000, lng: -122.4400, type: "music",      location: "San Francisco, USA",         label: "Golden Gate Busker",      species: null,                         intensity: 0.58, db: 59, time: "13:00", ago: "2h ago",   likes: 67,  listens: 193, user: "River S.",    duration: "3:45" },
  // ── Rio de Janeiro ──
  { id: 65, lat: -22.9068, lng: -43.1729, type: "music",       location: "Rio de Janeiro, Brazil",     label: "Samba on Ipanema",        species: null,                         intensity: 0.80, db: 75, time: "20:00", ago: "1h ago",   likes: 134, listens: 392, user: "Ana B.",      duration: "4:15" },
  { id: 66, lat: -22.9519, lng: -43.2105, type: "birds",       location: "Tijuca, Rio de Janeiro",     label: "Toucan in Tijuca",        species: "Ramphastos toco",            intensity: 0.75, db: 62, time: "07:00", ago: "6h ago",   likes: 99,  listens: 290, user: "Lucas F.",    duration: "1:00" },
  { id: 67, lat: -22.9800, lng: -43.1900, type: "rain",        location: "Rio de Janeiro, Brazil",     label: "Atlantic Forest Rain",    species: null,                         intensity: 0.84, db: 74, time: "14:00", ago: "3h ago",   likes: 61,  listens: 174, user: "Isabela M.",  duration: "8:30" },
  // ── Cape Town ──
  { id: 68, lat: -33.9249, lng:  18.4241, type: "birds",       location: "Cape Town, South Africa",    label: "Cape Sugarbird",          species: "Promerops cafer",            intensity: 0.66, db: 53, time: "08:00", ago: "5h ago",   likes: 77,  listens: 222, user: "Amara N.",    duration: "1:20" },
  { id: 69, lat: -33.9600, lng:  18.4000, type: "silence",     location: "Table Mountain, Cape Town",  label: "Table Mountain Stillness",species: null,                         intensity: 0.05, db: 16, time: "11:00", ago: "2h ago",   likes: 92,  listens: 264, user: "Sipho D.",    duration: "10:00" },
  { id: 70, lat: -33.9000, lng:  18.4600, type: "music",       location: "Cape Town, South Africa",    label: "Township Jazz",           species: null,                         intensity: 0.72, db: 68, time: "21:00", ago: "30m ago",  likes: 85,  listens: 245, user: "Lerato K.",   duration: "5:00" },
  // ── Nairobi ──
  { id: 71, lat:  -1.2921, lng:  36.8219, type: "birds",       location: "Nairobi, Kenya",             label: "Grey Crowned Crane",      species: "Balearica regulorum",        intensity: 0.77, db: 66, time: "06:30", ago: "7h ago",   likes: 88,  listens: 254, user: "Amina W.",    duration: "1:35" },
  { id: 72, lat:  -1.3100, lng:  36.8000, type: "insects",     location: "Nairobi, Kenya",             label: "Savanna Night Sounds",    species: null,                         intensity: 0.80, db: 70, time: "20:30", ago: "4h ago",   likes: 66,  listens: 190, user: "Kofi A.",     duration: "5:45" },
  // ── Reykjavik ──
  { id: 73, lat:  64.1265, lng: -21.8174, type: "silence",     location: "Reykjavik, Iceland",         label: "Arctic Stillness",        species: null,                         intensity: 0.03, db: 14, time: "00:00", ago: "1h ago",   likes: 112, listens: 328, user: "Sigrid E.",   duration: "15:00" },
  { id: 74, lat:  64.1500, lng: -21.9500, type: "birds",       location: "Reykjavik, Iceland",         label: "Puffin Colony",           species: "Fratercula arctica",         intensity: 0.72, db: 63, time: "10:00", ago: "3h ago",   likes: 104, listens: 302, user: "Björn H.",    duration: "2:30" },
  // ── Amazon ──
  { id: 75, lat:  -3.4653, lng: -62.2159, type: "birds",       location: "Amazon Rainforest, Brazil",  label: "Harpy Eagle Call",        species: "Harpia harpyja",             intensity: 0.86, db: 75, time: "06:00", ago: "10h ago",  likes: 148, listens: 436, user: "Eduardo S.",  duration: "0:18" },
  { id: 76, lat:  -3.5000, lng: -62.5000, type: "insects",     location: "Amazon Rainforest, Brazil",  label: "Amazon Night Orchestra",  species: null,                         intensity: 0.95, db: 88, time: "22:00", ago: "8h ago",   likes: 132, listens: 389, user: "Valentina P.",duration: "10:00" },
];

// ─── Convex helpers ────────────────────────────────────────────────────────────

const VALID_SOUND_TYPES = new Set<string>(["birds","traffic","music","rain","construction","insects","silence"]);

function formatAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type ConvexUpload = {
  _id: string;
  _creationTime: number;
  userId: string;
  storageId: string;
  title: string;
  lat?: number;
  lon?: number;
  locationLabel?: string;
  dominantClass?: string;
  likeCount: number;
  listenCount: number;
  durationSeconds?: number;
};

function mapConvexUpload(u: ConvexUpload, idx: number): Pin {
  const type = (u.dominantClass && VALID_SOUND_TYPES.has(u.dominantClass) ? u.dominantClass : "silence") as SoundType;
  const d = new Date(u._creationTime);
  return {
    id: `cx-${idx}-${u._id}`,
    lat: u.lat ?? 0,
    lng: u.lon ?? 0,
    type,
    label: u.title,
    species: null,
    intensity: 0.5,
    db: 50,
    time: d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
    ago: formatAgo(u._creationTime),
    likes: u.likeCount,
    listens: u.listenCount,
    user: "Community",
    duration: u.durationSeconds ? formatDuration(u.durationSeconds) : "?:??",
    location: u.locationLabel ?? "Unknown location",
    storageId: u.storageId,
  };
}

// ─── Search ───────────────────────────────────────────────────────────────────
function searchPins(pins: Pin[], query: string): Pin[] {
  const q = query.toLowerCase().trim();
  if (!q) return pins;
  const words = q.split(/\s+/);
  return pins.map(p => {
    const hay = [p.label, p.location, p.type, CFG[p.type].label, p.species ?? "", p.user].join(" ").toLowerCase();
    if (!words.every(w => hay.includes(w))) return null;
    const ll = p.label.toLowerCase(), loc = p.location.toLowerCase();
    const score = ll === q ? 100 : ll.startsWith(q) ? 80 : loc.startsWith(q) ? 70 : loc.includes(q) ? 55 : ll.includes(q) ? 50 : 30;
    return { pin: p, score };
  }).filter(Boolean).sort((a: any, b: any) => b.score - a.score).map((x: any) => x.pin);
}

// ─── Clustering ───────────────────────────────────────────────────────────────
function computeItems(pins: Pin[], map: L.Map | null): MapItem[] {
  if (!map) return pins.map(p => ({ kind: "single", pin: p }));
  const DIST = 60;
  const used = new Set<number>();
  const items: MapItem[] = [];
  const pts = pins.map(p => ({ pin: p, px: map.latLngToContainerPoint([p.lat, p.lng]) }));
  for (let i = 0; i < pts.length; i++) {
    if (used.has(i)) continue;
    const g = [i];
    for (let j = i + 1; j < pts.length; j++) {
      if (used.has(j)) continue;
      const dx = pts[i].px.x - pts[j].px.x, dy = pts[i].px.y - pts[j].px.y;
      if (Math.sqrt(dx * dx + dy * dy) < DIST) { g.push(j); used.add(j); }
    }
    used.add(i);
    if (g.length === 1) {
      items.push({ kind: "single", pin: pts[i].pin });
    } else {
      const gp = g.map(idx => pts[idx].pin);
      const lat = gp.reduce((s, p) => s + p.lat, 0) / gp.length;
      const lng = gp.reduce((s, p) => s + p.lng, 0) / gp.length;
      const freq: Record<string, number> = {};
      gp.forEach(p => { freq[p.type] = (freq[p.type] || 0) + 1; });
      const dominantType = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] as SoundType;
      items.push({ kind: "cluster", lat, lng, pins: gp, dominantType });
    }
  }
  return items;
}

// ─── Icon factories ────────────────────────────────────────────────────────────
function makePin(type: SoundType): L.DivIcon {
  const { icon } = CFG[type];
  const { name, dur, timing } = ANIM[type];
  return L.divIcon({
    className: "",
    iconSize:   [36, 36],
    iconAnchor: [18, 18],
    html: `<span style="font-size:24px;display:block;line-height:1;cursor:pointer;user-select:none;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.7));animation:${name} ${dur} ${timing} infinite;">${icon}</span>`,
  });
}

function makeCluster(count: number, dominantType: SoundType): L.DivIcon {
  const { color } = CFG[dominantType];
  const size = count >= 30 ? 50 : count >= 15 ? 42 : count >= 5 ? 36 : 32;
  const fs   = count >= 30 ? 16 : count >= 15 ? 14 : 12;
  return L.divIcon({
    className: "",
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;cursor:pointer;"><span style="color:#fff;font-size:${fs}px;font-weight:800;letter-spacing:-0.5px;">${count}</span></div>`,
  });
}

// ─── Map styles + chill keyframes ─────────────────────────────────────────────
function MapStyles() {
  useMapEvents({});
  useEffect(() => {
    const id = "v1-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      .leaflet-tile { filter:brightness(1.0) contrast(1.02) saturate(0.88) !important; }
      .leaflet-container { background:#111 !important; }
      .leaflet-control-zoom { display:none !important; }
      .leaflet-control-attribution { background:rgba(0,0,0,.45)!important;color:rgba(255,255,255,.15)!important;font-size:9px!important; }
      @keyframes birdFloat     { 0%,100%{transform:translateY(0)}    50%{transform:translateY(-4px)} }
      @keyframes carDrift      { 0%,100%{transform:translateX(0)}    50%{transform:translateX(3px)} }
      @keyframes musicSway     { 0%,100%{transform:rotate(-4deg) scale(1)} 50%{transform:rotate(4deg) scale(1.08)} }
      @keyframes rainDrop      { 0%,100%{transform:translateY(-2px)} 50%{transform:translateY(2px)} }
      @keyframes constNod      { 0%,100%{transform:rotate(0deg)}     50%{transform:rotate(2deg)} }
      @keyframes insectHover   { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-3px) rotate(4deg)} }
      @keyframes silenceBreathe{ 0%,100%{opacity:0.45;transform:scale(0.92)} 50%{opacity:1;transform:scale(1.04)} }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}

// ─── Cluster tracker ──────────────────────────────────────────────────────────
function ClusterTracker({ pins, onItems, onZoom }: { pins: Pin[]; onItems: (i: MapItem[]) => void; onZoom: (z: number) => void }) {
  const map = useMapEvents({
    zoomend: () => { onZoom(map.getZoom()); onItems(computeItems(pins, map)); },
    moveend: () => { onItems(computeItems(pins, map)); },
  });
  useEffect(() => {
    onZoom(map.getZoom());
    onItems(computeItems(pins, map));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins]);
  return null;
}

// ─── Waveform ─────────────────────────────────────────────────────────────────
function Waveform({ color }: { color: string }) {
  const bars = [18, 42, 28, 58, 34, 66, 48, 30, 72, 44, 24, 60, 38, 52, 22, 64, 32, 50, 26, 62];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 40 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 3, background: color, borderRadius: 3, height: `${h}%`, opacity: 0.8,
          animation: `wv${i % 3} ${.85 + (i % 5) * .12}s ease-in-out infinite alternate`,
          animationDelay: `${i * .05}s`,
        }} />
      ))}
    </div>
  );
}

// ─── Cluster panel ────────────────────────────────────────────────────────────
function ClusterPanel({ cluster, onClose, onSelectPin }: { cluster: Cluster; onClose: () => void; onSelectPin: (pin: Pin) => void }) {
  const typeCounts: Record<string, number> = {};
  cluster.pins.forEach(p => { typeCounts[p.type] = (typeCounts[p.type] || 0) + 1; });

  return (
    <>
      <div style={{ padding: "22px 20px 16px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ color: "#f8fafc", fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: -.3 }}>
            {cluster.pins.length} recordings
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.35)", cursor: "pointer", fontSize: 20, padding: "0 2px", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
            const cfg = CFG[type as SoundType];
            return (
              <span key={type} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, padding: "3px 10px", color: "rgba(255,255,255,.6)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                <span>{cfg.icon}</span><span>{count} {cfg.label}</span>
              </span>
            );
          })}
        </div>
        <p style={{ color: "rgba(255,255,255,.3)", fontSize: 11, margin: "10px 0 0" }}>Tap a recording to open it, or zoom in</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
        {cluster.pins.map(p => {
          const cfg = CFG[p.type];
          return (
            <button key={p.id} onClick={() => onSelectPin(p)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.05)", borderRadius: 10, transition: "background .15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.07)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,.03)")}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{cfg.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.label}</div>
                  <div style={{ color: "rgba(255,255,255,.3)", fontSize: 11, marginTop: 1 }}>{p.location} · {p.ago}</div>
                </div>
                <svg width={14} height={14} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth={1.8} style={{ flexShrink: 0 }}><polyline points="5,3 10,7 5,11" /></svg>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SoundMapInnerV1() {
  const [selected, setSelected]               = useState<Pin | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [filter, setFilter]                   = useState<"all" | SoundType>("all");
  const [playing, setPlaying]                 = useState(false);
  const [mapItems, setMapItems]               = useState<MapItem[]>([]);
  const [zoom, setZoom]                       = useState(3);
  const [searchQuery, setSearchQuery]         = useState("");
  const [dropdownOpen, setDropdownOpen]       = useState(false);
  const [showUpload, setShowUpload]           = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Load real uploads from Convex ──
  const convexUploads = useQuery(api.uploads.getRecent, { limit: 200 });

  // Merge: static world PINS + real uploads from DB (skip those without coords)
  const allPins = useMemo<Pin[]>(() => {
    const fromConvex = (convexUploads ?? [])
      .filter(u => u.lat !== undefined && u.lon !== undefined)
      .map((u, i) => mapConvexUpload(u as ConvexUpload, i));
    return [...PINS, ...fromConvex];
  }, [convexUploads]);

  const FILTER_TYPES: ("all" | SoundType)[] = ["all", "birds", "insects", "rain", "music", "traffic", "construction", "silence"];

  const categoryPins = useMemo(() => filter === "all" ? allPins : allPins.filter(p => p.type === filter), [filter, allPins]);
  const visiblePins  = useMemo(() => searchPins(categoryPins, searchQuery), [categoryPins, searchQuery]);

  const S = selected ? CFG[selected.type] : null;
  const panelOpen = selected !== null || selectedCluster !== null;

  const handleItems = useCallback((items: MapItem[]) => setMapItems(items), []);
  const handleZoom  = useCallback((z: number) => setZoom(z), []);
  const closePanel  = () => { setSelected(null); setSelectedCluster(null); };

  // Called after a successful upload — Convex query auto-refreshes so the pin
  // will appear once the query refetches (or immediately if optimistic)
  const handleUploadSuccess = useCallback((_result: UploadResult) => {
    setShowUpload(false);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const hasSearch  = searchQuery.length > 0;
  const hasFilter  = filter !== "all";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#111", overflow: "hidden", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* MAP */}
      <MapContainer center={[20, 120]} zoom={3}
        style={{ width: "100%", height: "100%", background: "#111" }}
        zoomControl={false} minZoom={2} maxZoom={18}>
        <MapStyles />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
        <ClusterTracker pins={visiblePins} onItems={handleItems} onZoom={handleZoom} />
        {mapItems.map((item, idx) =>
          item.kind === "single"
            ? <Marker key={`s-${item.pin.id}`} position={[item.pin.lat, item.pin.lng]} icon={makePin(item.pin.type)}
                eventHandlers={{ click: () => { setSelected(p => p?.id === item.pin.id ? null : item.pin); setSelectedCluster(null); } }} />
            : <Marker key={`c-${idx}`} position={[item.lat, item.lng]} icon={makeCluster(item.pins.length, item.dominantType)}
                eventHandlers={{ click: () => { setSelectedCluster(item); setSelected(null); } }} />
        )}
      </MapContainer>

      {/* ── SEARCH BAR (only top UI element) ── */}
      <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1000, display: "flex", gap: 8, alignItems: "flex-start" }}>

        {/* Search + dropdown wrapper */}
        <div ref={dropdownRef} style={{ width: 400 }}>

        {/* Input row */}
        <div style={{
          background: "rgba(12,12,12,.92)", backdropFilter: "blur(24px)",
          border: `1px solid ${dropdownOpen ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.13)"}`,
          borderRadius: dropdownOpen ? "14px 14px 0 0" : 14,
          padding: "0 14px",
          display: "flex", alignItems: "center", gap: 8, height: 44,
          transition: "border-color .15s",
        }}>
          {/* Search icon */}
          <svg width={14} height={14} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={2.2} style={{ flexShrink: 0 }}>
            <circle cx={6} cy={6} r={5} /><line x1={10} y1={10} x2={14} y2={14} />
          </svg>

          {/* Active filter chip */}
          {hasFilter && (
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => setFilter("all")}
              style={{ display: "flex", alignItems: "center", gap: 4, background: CFG[filter].color, border: "none", borderRadius: 8, padding: "3px 8px 3px 6px", cursor: "pointer", flexShrink: 0 }}>
              <span style={{ fontSize: 11 }}>{CFG[filter].icon}</span>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>{CFG[filter].label}</span>
              <span style={{ color: "rgba(255,255,255,.75)", fontSize: 13, lineHeight: 1, marginLeft: 1 }}>×</span>
            </button>
          )}

          <input
            ref={inputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setDropdownOpen(true)}
            placeholder={hasFilter ? `Search in ${CFG[filter].label}…` : "Search sounds, locations, species…"}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f1f5f9", fontSize: 13, minWidth: 0 }}
          />

          {/* Result count / clear */}
          {hasSearch && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ color: "rgba(255,255,255,.3)", fontSize: 11 }}>{visiblePins.length}</span>
              <button onMouseDown={e => e.preventDefault()} onClick={() => { setSearchQuery(""); inputRef.current?.focus(); }}
                style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,.12)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.6)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
          )}
        </div>

        {/* Dropdown: filter pills */}
        {dropdownOpen && (
          <div style={{ background: "rgba(12,12,12,.96)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,.13)", borderTop: "1px solid rgba(255,255,255,.06)", borderRadius: "0 0 14px 14px", padding: "10px 12px 12px" }}>
            <div style={{ color: "rgba(255,255,255,.22)", fontSize: 10, letterSpacing: 1.2, fontWeight: 600, marginBottom: 8, paddingLeft: 2 }}>FILTER BY TYPE</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {FILTER_TYPES.map(f => {
                const active = f === filter;
                const col    = f === "all" ? "#e2e8f0" : CFG[f].color;
                const count  = f === "all" ? allPins.length : allPins.filter(p => p.type === f).length;
                return (
                  <button key={f}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setFilter(f); setSearchQuery(""); inputRef.current?.focus(); }}
                    style={{
                      background: active ? col : "rgba(255,255,255,.06)",
                      border: `1px solid ${active ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.09)"}`,
                      borderRadius: 20, padding: "5px 12px",
                      color: active ? "#000" : "rgba(255,255,255,.55)",
                      fontSize: 12, fontWeight: active ? 700 : 400,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                      transition: "all .15s",
                    }}>
                    {f !== "all" && <span style={{ fontSize: 12 }}>{CFG[f].icon}</span>}
                    <span>{f === "all" ? "All sounds" : CFG[f].label}</span>
                    <span style={{ background: active ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.08)", borderRadius: 8, padding: "0 5px", fontSize: 10, color: active ? "rgba(0,0,0,.6)" : "rgba(255,255,255,.3)", fontWeight: 600 }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        </div>{/* end search+dropdown wrapper */}

        {/* Upload button */}
        <button
          onClick={() => setShowUpload(true)}
          title="Record or upload a sound"
          style={{
            flexShrink: 0,
            width: 44, height: 44,
            background: "rgba(12,12,12,.92)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(34,197,94,.4)",
            borderRadius: 14,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
            transition: "all .15s",
          }}
        >🎙</button>
      </div>

      {/* ── ZOOM BUTTONS ── */}
      <div style={{ position: "absolute", right: panelOpen ? 380 : 20, bottom: 24, zIndex: 1000, display: "flex", flexDirection: "column", gap: 4, transition: "right .35s cubic-bezier(.4,0,.2,1)" }}>
        {["+", "−"].map(b => (
          <div key={b} style={{ width: 36, height: 36, background: "rgba(12,12,12,.9)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, color: "rgba(255,255,255,.55)", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{b}</div>
        ))}
      </div>

      {/* ── SIDE PANEL ── */}
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: 360,
        background: "rgba(5,5,5,.97)", backdropFilter: "blur(32px)",
        borderLeft: "1px solid rgba(255,255,255,.08)",
        zIndex: 999,
        transform: panelOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform .32s cubic-bezier(.4,0,.2,1)",
        display: "flex", flexDirection: "column",
      }}>

        {/* Cluster panel */}
        {selectedCluster && !selected && (
          <ClusterPanel
            cluster={selectedCluster}
            onClose={closePanel}
            onSelectPin={pin => { setSelected(pin); setSelectedCluster(null); }}
          />
        )}

        {/* Single pin panel */}
        {selected && S && (
          <>
            <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h2 style={{ color: "#f8fafc", fontSize: 19, fontWeight: 700, margin: "0 0 3px", letterSpacing: -.3 }}>{selected.label}</h2>
                  {selected.species && <p style={{ color: "rgba(255,255,255,.3)", fontSize: 12, fontStyle: "italic", margin: "0 0 6px" }}>{selected.species}</p>}
                  <p style={{ color: "rgba(255,255,255,.35)", fontSize: 12, margin: 0 }}>📍 {selected.location}</p>
                </div>
                <button onClick={closePanel} style={{ background: "none", border: "none", color: "rgba(255,255,255,.35)", cursor: "pointer", fontSize: 22, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[`${selected.db} dB`, selected.ago, selected.duration, `by ${selected.user}`].map(t => (
                  <span key={t} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 6, padding: "3px 9px", color: "rgba(255,255,255,.45)", fontSize: 11 }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Waveform / audio player */}
            <div style={{ margin: "16px 20px 0", padding: "14px 16px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12 }}>
              {selected.storageId
                ? <AudioPlayerConvex storageId={selected.storageId as Id<"_storage">} color={S.color} duration={selected.duration} />
                : (
                  <>
                    <Waveform color={S.color} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                      <button onClick={() => setPlaying(p => !p)} style={{ width: 36, height: 36, background: S.color, border: "none", borderRadius: "50%", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                        {playing ? "⏸" : "▶"}
                      </button>
                      <div style={{ flex: 1, margin: "0 12px", height: 2, background: "rgba(255,255,255,.08)", borderRadius: 2 }} />
                      <span style={{ color: "rgba(255,255,255,.3)", fontSize: 11 }}>0:00 / {selected.duration}</span>
                    </div>
                  </>
                )
              }
            </div>

            {/* Metadata grid */}
            <div style={{ padding: "14px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Recorded", val: selected.time },
                { label: "Intensity", val: `${Math.round(selected.intensity * 100)}%` },
                { label: "Likes",    val: `♥ ${selected.likes}` },
                { label: "Listens",  val: `▶ ${selected.listens}` },
              ].map(({ label, val }) => (
                <div key={label} style={{ padding: "10px 12px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10 }}>
                  <div style={{ color: "rgba(255,255,255,.25)", fontSize: 10, marginBottom: 3 }}>{label}</div>
                  <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ padding: "16px 20px", display: "flex", gap: 8, marginTop: "auto" }}>
              <button style={{ flex: 1, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 10, color: "rgba(255,255,255,.7)", padding: "12px", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                ♥ {selected.likes}
              </button>
              <button style={{ flex: 2, background: S.color, border: "none", borderRadius: 10, color: "#fff", padding: "12px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                View Landscape →
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes wv0 { from{transform:scaleY(.3)}  to{transform:scaleY(1)}   }
        @keyframes wv1 { from{transform:scaleY(.5)}  to{transform:scaleY(.88)} }
        @keyframes wv2 { from{transform:scaleY(.4)}  to{transform:scaleY(1.1)} }
        input::placeholder { color:rgba(255,255,255,.22); }
      `}</style>

      {/* ── UPLOAD PANEL ── */}
      {showUpload && (
        <RecordUploadPanelDark
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}

// ─── AudioPlayerConvex ────────────────────────────────────────────────────────
// Fetches the real audio URL from Convex storage and renders a native player.
function AudioPlayerConvex({ storageId, color, duration }: { storageId: Id<"_storage">; color: string; duration: string }) {
  const url = useQuery(api.uploads.getStorageUrl, { storageId });
  return (
    <div>
      <Waveform color={color} />
      <div style={{ marginTop: 10 }}>
        {url
          ? <audio src={url} controls style={{ width: "100%", height: 34 }} />
          : <div style={{ color: "rgba(255,255,255,.3)", fontSize: 11, textAlign: "center", padding: "8px 0" }}>Loading audio…</div>
        }
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <span style={{ color: "rgba(255,255,255,.3)", fontSize: 11 }}>{duration}</span>
        </div>
      </div>
    </div>
  );
}
