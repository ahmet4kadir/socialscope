export type {
  Platform,
  AccountRole,
  MediaType,
  NormalizedPost,
  DataSource,
  AccountInfo,
  AccountRow,
  PostRow,
  SnapshotRow,
  TrackedPostRow,
  SweepRow,
} from './types';

export { extractHashtags } from './hashtags';
export { derivePostId } from './post-id';

export { engagementOf, type PostStats, type SnapshotPoint } from './metrics/types';
export {
  computeAccountMetrics,
  mediaTypeBreakdown,
  type AccountMetrics,
  type MediaTypeMetric,
} from './metrics/account';
export {
  bestHeatmapSlot,
  engagementHeatmap,
  type HeatmapCell,
} from './metrics/heatmap';
export { hashtagEngagement, type HashtagMetric } from './metrics/hashtags';
export {
  contentLengthPerformance,
  type LengthBucketMetric,
} from './metrics/content-length';
export {
  computePostTimeSeries,
  type CurvePoint,
  type GrowthInterval,
  type PostTimeSeriesMetrics,
} from './metrics/timeseries';
