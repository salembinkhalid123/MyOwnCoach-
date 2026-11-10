// Default data used the first time the app starts (or after "Reset all data").

export const APP_VERSION = '1.0.0';

// Rotation order of the split. Each id must exist in DEFAULT_DAYS.
export const ROTATION = ['push', 'pull', 'legs', 'upper', 'lower'];

export const DEFAULT_DAYS = [
  {
    id: 'push',
    name: 'Push',
    exercises: ['45° Bench Press', 'Pec Flies', 'Side Raises', 'Front Raises', 'Triceps Pushdown'],
  },
  {
    id: 'pull',
    name: 'Pull',
    exercises: ['Lat Pulldown', 'Seated Row', 'T-Bar Row', 'Rear Delts', 'Hammer Curls', 'Single-Arm Biceps Curl'],
  },
  {
    id: 'legs',
    name: 'Legs',
    exercises: ['Hack Squat', 'Leg Extension', 'Leg Curl', 'Calf Raises', 'Abs'],
  },
  {
    id: 'upper',
    name: 'Upper',
    exercises: [
      'Lat Pulldown', 'Seated Row', 'T-Bar Row', '45° Bench Press', 'Pec Flies',
      'Side Raises', 'Front Raises', 'Single-Arm Biceps Curl', 'Triceps Pushdown',
    ],
  },
  {
    id: 'lower',
    name: 'Lower',
    exercises: ['Hack Squat', 'Leg Extension', 'Leg Curl', 'Calf Raises', 'Abs'],
  },
];

export const DEFAULT_CALORIE_GOAL = 2200;

// Double progression rule.
export const PROGRESSION = {
  repTarget: 12,   // hit this many reps on ALL sets...
  increment: 2.5,  // ...then add this many kg next time
};

// How many empty sets a new exercise starts with when there is no history.
export const DEFAULT_SET_COUNT = 3;
