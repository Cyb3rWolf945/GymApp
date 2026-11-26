import type { Pt } from './geometry.ts';

// The figure in a 120 x 260 box (about 8 heads tall), described for the viewer's LEFT side and mirrored.
// `side` shapes are drawn twice (left and right); `center` shapes list the left half from top to bottom on the midline.

export interface Shape {
  /** Points along the outline. */
  pts: readonly Pt[];
  /** One shape on the midline (the points are its left half) instead of a mirrored pair. */
  center?: boolean;
}

const sh = (pts: readonly Pt[]): Shape => ({ pts });
const mid = (pts: readonly Pt[]): Shape => ({ pts, center: true });

/** The body: head, neck, torso, arms with hands, legs with feet. The same on the front and the back. */
export const SILHOUETTE: readonly Shape[] = [
  mid([[60, 3], [54, 6], [51, 15], [53, 24], [57, 29], [60, 30]]), // head
  mid([[60, 24], [54, 25], [53, 35], [60, 38]]), // neck
  mid([[60, 34], [46, 37], [34, 43], [31, 56], [34, 72], [38, 90], [40, 108], [37, 124], [35, 138], [38, 150], [47, 158], [60, 162]]), // torso
  sh([[32, 45], [25, 50], [20, 64], [19, 84], [17, 100], [14, 116], [11, 132], [10, 142], [14, 151], [19, 148], [21, 138], [24, 122], [27, 106], [29, 90], [31, 76], [33, 60]]), // arm and hand
  // Leg and foot: the foot turns out a little, with a heel at the ankle and rounded toes, all above the bottom of the box.
  sh([[37, 150], [31, 168], [30, 192], [33, 212], [32, 232], [33, 246], [30, 251], [26, 256], [26.5, 260.5], [33, 262], [41, 261.5], [46.5, 258], [46, 252], [45, 246], [45, 238], [46, 214], [50, 194], [54, 172], [58, 160], [47, 154]]),
];

export interface MuscleShape extends Shape {
  muscle: string;
}
const m = (muscle: string, s: Shape): MuscleShape => ({ muscle, ...s });

/** One region per visible muscle, front. Each is its own shape, so the figure reads as a body even with no heat. */
export const FRONT_MUSCLES: readonly MuscleShape[] = [
  m('neck_flexors', mid([[60, 27], [55.5, 29], [55, 34], [60, 37]])),
  m('trapezius', sh([[53, 35], [47, 36.5], [39, 41], [36, 45], [44, 44], [52, 41]])),
  m('deltoid_anterior', sh([[35, 44], [30, 44.5], [27, 50], [27, 60], [29, 68], [34, 64], [36, 54]])),
  m('deltoid_lateral', sh([[25, 47], [21, 52], [20, 64], [23, 70], [26, 67], [26, 58], [27, 50]])),
  m('pectoralis_major', sh([[58, 45], [48, 43], [40, 46], [36, 52], [37, 60], [44, 66], [52, 66], [58, 62]])),
  m('serratus_anterior', sh([[36, 68], [40, 66], [42, 72], [42, 82], [38, 84], [36, 76]])),
  m('biceps_brachii', sh([[31, 68], [27, 70], [25, 80], [25, 92], [28, 95], [31, 88], [32, 76]])),
  m('brachialis', sh([[25, 76], [22, 80], [21, 90], [23, 94], [25, 90]])),
  m('forearm_flexors', sh([[26, 100], [22, 104], [18, 116], [16, 128], [19, 130], [23, 120], [27, 108]])),
  m('rectus_abdominis', mid([[60, 68], [55, 68], [53, 80], [53, 96], [54, 110], [57, 119], [60, 121]])),
  m('obliques', sh([[52, 78], [44, 84], [41, 96], [41, 112], [45, 120], [51, 118], [52, 100]])),
  m('hip_flexors', sh([[52, 120], [46, 121], [41, 128], [42, 138], [50, 142], [54, 132]])),
  m('hip_adductors', sh([[56, 140], [52, 144], [50, 160], [48, 176], [52, 182], [57, 170], [58, 152]])),
  m('quadriceps', sh([[47, 142], [40, 146], [34, 160], [32, 182], [36, 200], [44, 202], [49, 186], [50, 160]])),
  m('tibialis_anterior', sh([[40, 214], [35, 216], [34, 232], [36, 246], [40, 248], [42, 232]])),
];

export const BACK_MUSCLES: readonly MuscleShape[] = [
  m('trapezius', mid([[60, 34], [52, 37], [44, 43], [46, 54], [54, 70], [60, 92]])),
  m('deltoid_posterior', sh([[35, 44], [30, 45], [26, 52], [26, 62], [30, 66], [35, 60]])),
  m('rhomboids', sh([[58, 56], [52, 58], [48, 66], [52, 76], [58, 74]])),
  m('latissimus_dorsi', sh([[52, 72], [44, 66], [38, 70], [37, 82], [41, 98], [48, 106], [54, 100], [52, 86]])),
  m('triceps_brachii', sh([[31, 62], [27, 66], [24, 80], [24, 94], [28, 96], [31, 84], [32, 72]])),
  m('forearm_extensors', sh([[26, 100], [22, 104], [18, 116], [16, 128], [19, 130], [23, 120], [27, 108]])),
  m('erector_spinae', sh([[58, 98], [54, 98], [53, 112], [54, 124], [58, 126]])),
  m('gluteus_medius', sh([[46, 122], [40, 124], [37, 132], [41, 138], [50, 134]])),
  m('gluteus_maximus', sh([[58, 128], [50, 134], [41, 140], [39, 152], [46, 160], [56, 158], [59, 146]])),
  m('hamstrings', sh([[56, 162], [46, 162], [38, 170], [34, 188], [37, 204], [46, 206], [52, 190], [56, 176]])),
  m('gastrocnemius', sh([[46, 210], [37, 212], [34, 220], [36, 232], [42, 234], [46, 224]])),
  m('soleus', sh([[35, 232], [34, 242], [37, 252], [42, 250], [43, 238], [40, 233]])),
];

/** Thin lines inside the figure (open curves, left side, mirrored): abs segments, the pec edge, the quad heads, the spine. */
export const FRONT_DETAILS: readonly (readonly Pt[])[] = [
  [[60, 68], [60, 100], [60, 120]],
  [[54, 82], [60, 83], [66, 82]],
  [[54, 96], [60, 97], [66, 96]],
  [[54, 108], [60, 109], [66, 108]],
  [[38, 62], [46, 69], [58, 66]],
  [[41, 150], [40, 172], [42, 196]],
  [[28, 52], [28, 62], [30, 68]],
];
export const BACK_DETAILS: readonly (readonly Pt[])[] = [
  [[60, 40], [60, 100], [60, 130]],
  [[60, 134], [60, 158]],
  [[44, 140], [42, 150], [46, 158]],
  [[28, 52], [28, 62], [31, 66]],
  [[40, 206], [41, 224]],
];
