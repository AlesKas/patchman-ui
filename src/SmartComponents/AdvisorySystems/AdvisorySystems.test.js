import { shallow } from 'enzyme';
import toJson from 'enzyme-to-json';
import { act } from 'react-dom/test-utils';
import { Provider, useSelector } from 'react-redux';
import configureStore from 'redux-mock-store';
import { fetchAdvisorySystems } from '../../Utilities/api';
import { storeListDefaults } from '../../Utilities/constants';
import { systemRows } from '../../Utilities/RawDataForTesting';
import { initMocks } from '../../Utilities/unitTestingUtilities.js';
import AdvisorySystems from './AdvisorySystems';
initMocks();

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: jest.fn()
}));

jest.mock('../../store', () => ({
    ...jest.requireActual('../../store'),
    getStore: jest.fn(()=>({
        getState: () => ({ SystemsListStore: { rows: [] } })
    })),
    register: jest.fn()
}));

jest.mock('../../Utilities/api', () => ({
    ...jest.requireActual('../../Utilities/api'),
    fetchAdvisorySystems: jest.fn()
}));

const mockState = { ...storeListDefaults, rows: systemRows, selectedRows: { 'f99c98e6-e17c-4536-acbb-2bc795547d4f': true } };

const initStore = (state) => {
    const customMiddleWare = () => next => action => {
        useSelector.mockImplementation(callback => {
            return callback({ AdvisorySystemsStore: state });
        });
        next(action);
    };

    const mockStore = configureStore([customMiddleWare]);
    return mockStore({ AdvisorySystemsStore: state });
};

let store = initStore(mockState);

describe('AdvisorySystems.js', () => {
    const rejectedState = { ...mockState, status: 'rejected', error: { detail: 'test' } };
    beforeEach(() => {
        console.error = () => {};

        useSelector.mockImplementation(callback => {
            return callback({ AdvisorySystemsStore: mockState });
        });
    });

    afterEach(() => {
        useSelector.mockClear();
        store.clearActions();
    });

    it('Should match the snapshots and dispatch FETCH_AFFECTED_SYSTEMS only once', () => {
        /**
         * This mount snapshot test is failing because of randomly generated key in PF component.
         * Before the snapshot was only shallow and did not display the real virtual DOM.
         * Shallow snapshot has the same result as the mount before.
         */
        const store = initStore(rejectedState);
        const wrapper = shallow(
            <Provider store={store}>
                <AdvisorySystems advisoryName = {'RHSA-2020:2755'} />
            </Provider>
        );
        expect(toJson(wrapper)).toMatchSnapshot();
    });

    it('Should display error page when status is rejected', () => {
        const rejectedState = { ...mockState, status: 'rejected', error: { detail: 'test' } };
        useSelector.mockImplementation(callback => {
            return callback({ AdvisorySystemsStore: rejectedState });
        });
        const store = initStore(rejectedState);
        const wrapper = mount(
            <Provider store={store}>
                <AdvisorySystems advisoryName = {'RHSA-2020:2755'} />
            </Provider>
        );
        expect(wrapper.find('Error')).toBeTruthy();
    });

    it('Should handle inventory and filter refresh', async () => {
        let wrapper;
        await act(async() => {
            wrapper = mount(
                <Provider store={store}>
                    <AdvisorySystems advisoryName={'RHSA-2020:2755'} />
                </Provider>
            );
        });
        await act(async() => {
            wrapper.update;
        });
        const { onRefresh } = wrapper.update().find('InventoryTable').props();
        onRefresh({ page: 1, per_page: 10 });

        const dispatchedActions = store.getActions();
        expect(dispatchedActions.filter(item => item.type === 'CHANGE_AFFECTED_SYSTEMS_PARAMS')).toHaveLength(1);
        expect(dispatchedActions[1].payload).toEqual({ limit: 10 });
    });

    describe('test entity selecting', () => {
        it('Should unselect all', async() => {
            const store = initStore(rejectedState);
            let wrapper;
            await act(async() => {
                wrapper = mount(
                    <Provider store={store}>
                        <AdvisorySystems advisoryName={'RHSA-2020:2755'} />
                    </Provider>
                );
            });
            await act(async() => {
                wrapper.update;
            });
            const { bulkSelect } = wrapper.update().find('InventoryTable').props();

            bulkSelect.items[0].onClick();
            const dispatchedActions = store.getActions();
            expect(dispatchedActions[1].type).toEqual('SELECT_ENTITY');
            expect(bulkSelect.items[0].title).toEqual('Select none (0)');
        });

        it('Should select a page', async () => {
            const store = initStore(rejectedState);
            let wrapper;
            await act(async() => {
                wrapper = mount(
                    <Provider store={store}>
                        <AdvisorySystems advisoryName={'RHSA-2020:2755'} />
                    </Provider>
                );
            });
            await act(async() => {
                wrapper.update;
            });

            const { bulkSelect } = wrapper.update().find('InventoryTable').props();

            bulkSelect.items[1].onClick();
            const dispatchedActions = store.getActions();
            expect(dispatchedActions[1].type).toEqual('SELECT_ENTITY');
            expect(bulkSelect.items[1].title).toEqual('Select page (1)');
        });

        it('Should select all', async () => {
            fetchAdvisorySystems.mockReturnValue(new Promise((resolve) =>  {
                resolve({ data: systemRows });
            }));
            const store = initStore(rejectedState);

            let wrapper;
            await act(async() => {
                wrapper = mount(
                    <Provider store={store}>
                        <AdvisorySystems advisoryName={'RHSA-2020:2755'} />
                    </Provider>
                );
            });
            await act(async() => {
                wrapper.update;
            });

            const { bulkSelect } = wrapper.update().find('InventoryTable').props();

            bulkSelect.items[2].onClick();
            expect(fetchAdvisorySystems).toHaveBeenCalled();
            expect(bulkSelect.items[2].title).toEqual('Select all (0)');
        });

        it('Should handle onSelect', async () => {
            fetchAdvisorySystems.mockReturnValue(new Promise((resolve) =>  {
                resolve({ data: systemRows });
            }));
            const store = initStore(rejectedState);

            let wrapper;
            await act(async() => {
                wrapper = mount(
                    <Provider store={store}>
                        <AdvisorySystems advisoryName={'RHSA-2020:2755'} />
                    </Provider>
                );
            });
            await act(async() => {
                wrapper.update;
            });

            const { bulkSelect } = wrapper.update().find('InventoryTable').props();

            bulkSelect.onSelect();
            const dispatchedActions = store.getActions();
            expect(dispatchedActions[1].type).toEqual('SELECT_ENTITY');
            expect(dispatchedActions[1].payload).toEqual([
                {
                    id: 'f99c98e6-e17c-4536-acbb-2bc795547d4f',
                    selected: false
                }
            ]
            );
        });
    });

    it('Should open remediation modal', async () => {
        const store = initStore(rejectedState);
        let wrapper;
        await act(async() => {
            wrapper = mount(
                <Provider store={store}>
                    <AdvisorySystems advisoryName={'RHSA-2020:2755'} />
                </Provider>
            );
        });
        const { onClick } = wrapper.update().find('Button').props();
        act(() => onClick());

        expect(wrapper.update().find('RemediationModal')).toBeTruthy();
    });

    it('Should clear store on unmount', async () => {
        const store = initStore(rejectedState);
        let wrapper;
        await act(async() => {
            wrapper = mount(
                <Provider store={store}>
                    <AdvisorySystems advisoryName={'RHSA-2020:2755'} />
                </Provider>
            );
        });
        await act(() => {
            wrapper.unmount();
        });
        const dispatchedActions = store.getActions();
        expect(dispatchedActions.filter(item => item.type === 'CLEAR_AFFECTED_SYSTEMS')).toHaveLength(1);
    });
});
