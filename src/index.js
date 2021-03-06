import combineSelectors from 'combine-selectors';
import { state, actions, subscribe, constants as stateConstants } from 'todo-redux-state';

import * as PATHS from './site/constants/paths';

import selectedPage from './site/selected-page';
import url from './site/url';
import siteHeader from './site/site-header';
import todos from './todos/todos';

const rawSelectors = {
	selectedPage,
	url,
	siteHeader,
	todos
};

const selectors = combineSelectors(rawSelectors, () => state);

const constants = {
	...stateConstants,
	PATHS
};

const final = {
	selectors,
	actions,
	constants,
	subscribe
};

Object.defineProperty(final, "state", { get: () => state });

export default final;

export {
	selectors,
	actions,
	constants,
	subscribe
}

Object.defineProperty(exports, "state", { get: () => state });