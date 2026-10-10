// Activity registry. To add a new activity, create a module with
// { id, title, blurb, icon, status(), start(root, ctx) } and list it here.
import story from './story.js';
import drill from './drill.js';
import cards from './cards.js';

export const ACTIVITIES = [story, drill, cards];
export const getActivity = (id) => ACTIVITIES.find((a) => a.id === id);
