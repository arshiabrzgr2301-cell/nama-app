export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Dashboard: undefined;
  AddProperty: undefined;
  PropertyDetail: { id: string };
  TourViewer: { id: string; panoramaUrl?: string };
  VRMode: { id: string; panoramaUrl?: string };
  VideoProcessing: { id: string };
  ScanGuide: undefined;
};
