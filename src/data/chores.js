// chores.js — the family's kids and their chore definitions (final structure).
// Classic-script global: exposes KIDS on window. Completion state is NOT stored
// here — it lives per-week in localStorage via QuestStore. This file is just the
// static definition of who has which chores.
//
// `avatar` is optional illustrated art in /assets/avatars/ (e.g. 'emma.webp').
// When set and the file exists it replaces the colored initial circle; if the
// file is missing it falls back to the initial automatically. Drop-in.

const KIDS = [
  {
    id: 'emma', name: 'Emma', initial: 'E', color: '#4a7c59', avatarBg: '#c8e6c9', avatar: null,
    chores: [
      { id: 'e1', name: 'Make bed',          description: 'Sheets tucked, pillows straight', frequency: 'Daily' },
      { id: 'e2', name: 'Water plants',       description: 'Check soil is dry first',         frequency: 'Daily' },
      { id: 'e3', name: 'Clean room',         description: 'Floor clear, toys put away',      frequency: 'Daily' },
      { id: 'e4', name: 'Set table',          description: 'Plates, cups, napkins, silverware', frequency: 'Daily' },
      { id: 'e5', name: 'Unload dishwasher',  description: 'Put away clean dishes',           frequency: 'Daily' },
    ],
  },
  {
    id: 'jack', name: 'Jack', initial: 'J', color: '#3a6ea5', avatarBg: '#bbdefb', avatar: null,
    chores: [
      { id: 'j1', name: 'Feed pet',        description: 'Morning and evening feeding',   frequency: 'Daily' },
      { id: 'j2', name: 'Homework',        description: 'All assignments completed',     frequency: 'Daily' },
      { id: 'j3', name: 'Tidy room',       description: 'Bed made, floor clear',         frequency: 'Daily' },
      { id: 'j4', name: 'Take out trash',  description: 'All bins to curb on pickup day', frequency: 'Weekly' },
    ],
  },
  {
    id: 'lucy', name: 'Lucy', initial: 'L', color: '#7b5ea7', avatarBg: '#e1bee7', avatar: null,
    chores: [
      { id: 'l1', name: 'Brush teeth',       description: 'Morning and night, 2 minutes', frequency: 'Daily' },
      { id: 'l2', name: 'Pick up toys',      description: 'Living room and bedroom',       frequency: 'Daily' },
      { id: 'l3', name: 'Help with laundry', description: 'Sort colors and whites',        frequency: 'Weekly' },
      { id: 'l4', name: 'Read for 20 min',   description: 'Any book of your choice',       frequency: 'Daily' },
    ],
  },
];

window.KIDS = KIDS;
