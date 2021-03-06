import * as React from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import { push } from 'react-router-redux';
import { FormattedMessage, injectIntl, InjectedIntlProps } from 'react-intl';
import { connect } from 'react-redux';
import {
  Button,
  Icon,
  Table,
  Drawer,
  Card,
  Input,
  Select,
  notification
} from 'antd';
import { ColumnProps } from 'antd/lib/table';
import * as moment from 'moment';
import { includes } from 'lodash';
import { Dispatch } from 'redux';
import { InjectedAuthRouterProps } from 'redux-auth-wrapper/history4/redirect';

import * as PodModel from '@/models/Pod';
import * as DeploymentModel from '@/models/Deployment';
import { RootState, RTDispatch, RootAction } from '@/store/ducks';
import {
  clusterOperations,
  clusterSelectors,
  clusterActions
} from '@/store/ducks/cluster';
import ItemActions from '@/components/ItemActions';
import DeploymentDetail from '@/components/DeploymentDetail';

import * as styles from './styles.module.scss';
import withCapitalize from '@/containers/withCapitalize';

const CapitalizedMessage = withCapitalize(FormattedMessage);
const InputGroup = Input.Group;
const Search = Input.Search;
const Option = Select.Option;

interface DeploymentState {
  searchType: string;
  searchText: string;
}

type DeploymentProps = OwnProps &
  InjectedAuthRouterProps &
  InjectedIntlProps &
  RouteComponentProps<{ name: string }>;

interface OwnProps {
  pods: PodModel.Pods;
  podsNics: PodModel.PodsNics;
  fetchPods: () => any;
  removePodByName: (namespace: string, id: string) => any;
  deployments: DeploymentModel.Controllers;
  allDeployments: Array<string>;
  fetchDeployments: () => any;
  fetchDeploymentsFromMongo: () => any;
  removeDeployment: (id: string) => any;
  push: (path: string) => any;
  autoscale: (data: DeploymentModel.Autoscale, enable: boolean) => any;
  error: Error | null;
  clearClusterError: () => any;
}

interface DeploymentInfo {
  id: string;
  name: string;
  type: string;
  owner: string;
  namespace: string;
  desiredPod: number;
  currentPod: number;
  availablePod: number;
  createdAt: string;
}

class Deployment extends React.PureComponent<DeploymentProps, DeploymentState> {
  private intervalPodId: number;
  private columns: Array<ColumnProps<DeploymentInfo>> = [
    {
      title: <CapitalizedMessage id="name" />,
      dataIndex: 'name',
      width: 300
    },
    {
      title: <CapitalizedMessage id="owner" />,
      dataIndex: 'owner'
    },
    {
      title: <CapitalizedMessage id="namespace" />,
      dataIndex: 'namespace'
    },
    {
      title: <CapitalizedMessage id="deployment.desiredPod" />,
      dataIndex: 'desiredPod'
    },
    {
      title: <CapitalizedMessage id="deployment.currentPod" />,
      dataIndex: 'currentPod'
    },
    {
      title: <CapitalizedMessage id="deployment.availablePod" />,
      dataIndex: 'availablePod'
    },
    {
      title: <CapitalizedMessage id="createdAt" />,
      dataIndex: 'createdAt'
    },
    {
      title: <CapitalizedMessage id="action" />,
      render: (_, record) => (
        <ItemActions
          items={[
            {
              type: 'link',
              link: {
                to: {
                  pathname: `/application/deployment/${record.name}`
                }
              }
            }
          ]}
        />
      )
    }
  ];

  public state: DeploymentState = {
    searchType: 'deployment',
    searchText: ''
  };

  public componentDidMount() {
    this.intervalPodId = window.setInterval(this.props.fetchPods, 5000);
    this.props.fetchPods();
    this.props.fetchDeployments();
    this.props.fetchDeploymentsFromMongo();
  }

  public componentWillUnmount() {
    clearInterval(this.intervalPodId);
  }

  protected handleChangeSearchType = (type: string) => {
    this.setState({ searchType: type, searchText: '' });
  };

  protected handleSearch = (e: React.FormEvent<HTMLInputElement>) => {
    this.setState({ searchText: e.currentTarget.value });
  };

  protected handleRemoveDeployment = (id: string) => {
    this.props.clearClusterError();
    this.props.removeDeployment(id);
    this.props.push('/application/deployment');

    const { formatMessage } = this.props.intl;

    if (!this.props.error) {
      notification.success({
        message: formatMessage({
          id: 'action.success'
        }),
        description: formatMessage({
          id: 'deployment.hint.delete.success'
        })
      });
    } else {
      notification.error({
        message: formatMessage({
          id: 'action.failure'
        }),
        description:
          formatMessage({
            id: 'deployment.hint.delete.failure'
          }) +
          ' (' +
          this.props.error.message +
          ')'
      });
    }
  };

  protected getDeploymentInfo = (allDeployments: Array<string>) => {
    const { deployments } = this.props;
    return allDeployments.map(deployment => {
      const displayName =
        deployments[deployment].createdBy === undefined
          ? 'none'
          : deployments[deployment].createdBy!.displayName;
      return {
        id: deployments[deployment].id,
        name: deployments[deployment].controllerName,
        owner: displayName,
        type: deployments[deployment].type,
        namespace: deployments[deployment].namespace,
        desiredPod: deployments[deployment].desiredPod,
        currentPod: deployments[deployment].currentPod,
        availablePod: deployments[deployment].availablePod,
        createdAt: moment(deployments[deployment].createAt * 1000).fromNow()
      };
    });
  };

  public renderTable = () => {
    const { searchType, searchText } = this.state;
    const filterDeployments = this.props.allDeployments.filter(name => {
      switch (searchType) {
        default:
        case 'deployment':
          return includes(
            this.props.deployments[name].controllerName,
            searchText
          );
        case 'pod':
          for (const pod of this.props.deployments[name].pods) {
            if (includes(pod, searchText)) {
              return true;
            }
          }
          return false;
        case 'namespace':
          return includes(this.props.deployments[name].namespace, searchText);
      }
    });
    return (
      <Table
        className="main-table"
        columns={this.columns}
        dataSource={this.getDeploymentInfo(filterDeployments)}
      />
    );
  };

  public render() {
    const { deployments, pods, match } = this.props;
    const currentDeployment = match.params.name;
    const visibleDeploymentDrawer = !!currentDeployment;

    return (
      <div>
        <Card
          title={<CapitalizedMessage id="deployment" />}
          extra={
            <Link className={styles.action} to="/application/deployment/create">
              <Button>
                <Icon type="plus" /> <CapitalizedMessage id="deployment.add" />
              </Button>
            </Link>
          }
        >
          <div className="table-controls">
            <InputGroup compact={true}>
              <Select
                style={{ width: '15%' }}
                defaultValue="deployment"
                onChange={this.handleChangeSearchType}
              >
                <Option value="deployment">
                  <CapitalizedMessage id="deployment.filter.deploymentName" />
                </Option>
                <Option value="pod">
                  <CapitalizedMessage id="deployment.filter.podName" />
                </Option>
                <Option value="namespace">
                  <CapitalizedMessage id="deployment.filter.namespaceName" />
                </Option>
              </Select>
              <Search
                style={{ width: '25%' }}
                placeholder={this.props.intl.formatMessage(
                  {
                    id: 'form.placeholder.filter'
                  },
                  {
                    field: this.props.intl.formatMessage({
                      id: 'deployment'
                    })
                  }
                )}
                value={this.state.searchText}
                onChange={this.handleSearch}
              />
            </InputGroup>
          </div>
          {this.renderTable()}
          <Drawer
            title={<CapitalizedMessage id="deployment" />}
            width={720}
            closable={false}
            onClose={this.props.push.bind(this, '/application/deployment')}
            visible={visibleDeploymentDrawer}
          >
            {deployments.hasOwnProperty(currentDeployment) && (
              <DeploymentDetail
                autoscale={this.props.autoscale}
                deployment={deployments[currentDeployment]}
                pods={pods}
                removeDeployment={this.handleRemoveDeployment}
              />
            )}
          </Drawer>
        </Card>
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => {
  state.cluster.deploymentsFromMongo.forEach(deployment => {
    if (state.cluster.deployments[deployment.name] !== undefined) {
      state.cluster.deployments[deployment.name].id = deployment.id;
      state.cluster.deployments[deployment.name].ownerID = deployment.ownerID;
      state.cluster.deployments[deployment.name].createdBy =
        deployment.createdBy;
      state.cluster.deployments[deployment.name].isEnableAutoscale =
        deployment.isEnableAutoscale;
      state.cluster.deployments[deployment.name].autoscalerInfo =
        deployment.autoscalerInfo;
    }
  });
  return {
    pods: clusterSelectors.getPodsInAvailableNamespace(state.cluster),
    podsNics: state.cluster.podsNics,
    deployments: clusterSelectors.getDeploymentsInAvailableNamespace(
      state.cluster
    ),
    allDeployments: clusterSelectors.getAllDeploymentsInAvailableNamespace(
      state.cluster
    ),
    users: state.user.users,
    error: state.cluster.error
  };
};

const mapDispatchToProps = (dispatch: Dispatch<RootAction> & RTDispatch) => ({
  fetchPods: () => dispatch(clusterOperations.fetchPods()),
  removePodByName: (namespace: string, id: string) =>
    dispatch(clusterOperations.removePodByName(namespace, id)),
  fetchDeployments: () => dispatch(clusterOperations.fetchDeployments()),
  fetchDeploymentsFromMongo: () =>
    dispatch(clusterOperations.fetchDeploymentsFromMongo()),
  removeDeployment: (id: string) =>
    dispatch(clusterOperations.removeDeployment(id)),
  push: (path: string) => dispatch(push(path)),
  autoscale: (data: DeploymentModel.Autoscale, enable: boolean) =>
    dispatch(clusterOperations.autoscale(data, enable)),
  clearClusterError: () => dispatch(clusterActions.clearClusterError())
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(Deployment));
