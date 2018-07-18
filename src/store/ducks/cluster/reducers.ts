import { ActionType, StateType, getType } from 'typesafe-actions';
import * as Cluster from './actions';

export type ClusterStateType = StateType<typeof clusterReducer>;
export type ClusterActionType = ActionType<typeof Cluster>;

const initialState = {
  nodes: []
};

export function clusterReducer(
  state = initialState,
  action: ClusterActionType
) {
  if (state === undefined) {
    return initialState;
  }

  switch (action.type) {
    case getType(Cluster.fetchNodes.success):
      return { ...state, nodes: action.payload };
    default:
      return state;
  }
}
