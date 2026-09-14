import React from "react";
import { View, type ViewProps } from "react-native";

/**
 * Web stub for `react-native-maps`, which ships no web build.
 *
 * The browser is not a target — iOS and Android are — but being able to run
 * `expo start --web` makes design review and copy checks fast, and without this
 * the bundle fails at import time. Nothing here ever renders in practice:
 * `mapsAvailable()` is false on web, so `DeliveryMap` and `LocationPicker`
 * already take their offline branch. These exist only so the imports resolve.
 */
export const PROVIDER_GOOGLE = "google";
export const PROVIDER_DEFAULT = undefined;

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const Marker = (props: ViewProps) => <View {...props} />;
export const Polyline = () => null;
export const Circle = () => null;
export const Callout = (props: ViewProps) => <View {...props} />;

class MapView extends React.Component<ViewProps> {
  animateToRegion() {}
  fitToCoordinates() {}
  render() {
    return <View {...this.props} />;
  }
}

export default MapView;
