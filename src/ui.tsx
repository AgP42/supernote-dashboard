/** Shared e-ink UI primitives (high contrast, no animation). */
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';

export function Hairline(): React.JSX.Element {
  return <View style={ui.hairline} />;
}

export function Btn({
  label,
  onPress,
  disabled,
  small,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  small?: boolean;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[ui.btn, small && ui.btnSmall, disabled && ui.btnDisabled]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={[ui.btnText, small && ui.btnTextSmall]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const ui = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#ffffff', padding: 14},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  title: {fontSize: 24, fontWeight: '700', color: '#000000', flexShrink: 1},
  row: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center'},
  headerBtns: {flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', flexShrink: 0},
  iconBtn: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000000', paddingVertical: 4, paddingHorizontal: 12, marginLeft: 6},
  iconText: {fontSize: 18, fontWeight: '700', color: '#000000'},
  iconBtnGhost: {paddingVertical: 4, paddingHorizontal: 8, marginLeft: 6},
  iconTextGhost: {fontSize: 18, color: '#777777'},
  hint: {fontSize: 12, color: '#000000', marginTop: 6, marginBottom: 8},
  hairline: {height: 1, backgroundColor: '#000000', marginVertical: 12, opacity: 0.5},
  zoneGrid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between'},
  zoneCell: {width: '48%'},
  btn: {borderWidth: 2, borderColor: '#000000', paddingVertical: 9, paddingHorizontal: 14, marginRight: 8, marginBottom: 8},
  btnSmall: {paddingVertical: 5, paddingHorizontal: 9, marginRight: 6, marginBottom: 6},
  btnDisabled: {borderColor: '#999999'},
  btnText: {fontSize: 15, fontWeight: '600', color: '#000000'},
  btnTextSmall: {fontSize: 13},
  // zones — shared
  zoneMeta: {fontSize: 11, color: '#444444'},
  metaMono: {fontFamily: 'monospace', fontSize: 10, color: '#777777'},
  listItem: {fontSize: 14, color: '#000000', paddingVertical: 6},
  noteHead: {fontSize: 14, fontWeight: '600', color: '#000000', marginTop: 6},
  pageLine: {fontSize: 13, color: '#000000', paddingVertical: 3, paddingLeft: 14},
  pageNum: {fontFamily: 'monospace', fontSize: 12, color: '#333333'},
  empty: {fontSize: 13, color: '#666666', paddingVertical: 6},
  refreshRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4},
  // theme: ledger
  ledgerZone: {borderTopWidth: 1, borderColor: '#000000', paddingTop: 8, marginTop: 12},
  ledgerHead: {flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between'},
  ledgerLabel: {fontSize: 11, letterSpacing: 1.6, fontWeight: '700', color: '#000000', textTransform: 'uppercase'},
  // theme: boxed
  boxFrame: {borderWidth: 1.5, borderColor: '#000000', borderRadius: 8, overflow: 'hidden', marginBottom: 10},
  boxCap: {backgroundColor: '#000000', paddingVertical: 4, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  boxCapText: {color: '#ffffff', fontWeight: '700', fontSize: 13},
  boxCapMeta: {color: '#cccccc', fontFamily: 'monospace', fontSize: 10},
  boxBody: {paddingVertical: 7, paddingHorizontal: 10},
  // theme: airy
  airyZone: {marginTop: 20},
  airyLabel: {fontSize: 12, letterSpacing: 1.3, fontWeight: '700', color: '#666666', textTransform: 'uppercase', marginBottom: 5},
  // apps variants
  appUnderline: {fontSize: 13, color: '#000000', borderBottomWidth: 1.5, borderColor: '#000000', marginRight: 14, marginBottom: 4, paddingBottom: 1},
  appTile: {borderWidth: 1.5, borderColor: '#000000', borderRadius: 7, paddingVertical: 6, paddingHorizontal: 12, marginRight: 6, marginBottom: 6, fontSize: 13, fontWeight: '600', color: '#000000'},
  appPlain: {fontSize: 14, fontWeight: '600', color: '#000000', marginRight: 18, marginBottom: 4},
  chip: {borderWidth: 1.2, borderColor: '#000000', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, marginRight: 6, marginBottom: 6, fontSize: 13, color: '#000000'},
  inlineLine: {fontSize: 13.5, color: '#000000', paddingVertical: 4},
  inlineKw: {fontWeight: '700', color: '#000000'},
  // config
  json: {flex: 1, borderWidth: 1, borderColor: '#000000', padding: 8, color: '#000000', fontFamily: 'monospace', fontSize: 12, textAlignVertical: 'top'},
  titleInput: {borderWidth: 1.5, borderColor: '#000000', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: '#000000', backgroundColor: '#ffffff'},
  status: {fontSize: 12, color: '#000000', marginBottom: 6},
  picker: {maxHeight: 320, borderWidth: 1, borderColor: '#000000', marginTop: 4},
  pickerItem: {fontSize: 13, color: '#000000', padding: 8, borderBottomWidth: 1, borderColor: '#cccccc'},
  // stepper / structured settings
  stepper: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: 8},
  stepTab: {borderWidth: 1, borderColor: '#000000', paddingVertical: 5, paddingHorizontal: 9, marginRight: 4, marginBottom: 4},
  stepTabOn: {backgroundColor: '#000000'},
  stepText: {fontSize: 13, color: '#000000', fontWeight: '600'},
  stepTextOn: {color: '#ffffff'},
  groupLabel: {fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#555555', fontWeight: '700', marginTop: 14, marginBottom: 6},
  subLabel: {fontSize: 11, color: '#666666', marginTop: 8, marginBottom: 4},
  choice: {borderWidth: 1.5, borderColor: '#000000', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8, marginBottom: 8},
  choiceOn: {backgroundColor: '#000000'},
  choiceText: {fontSize: 14, color: '#000000', fontWeight: '600'},
  choiceTextOn: {color: '#ffffff'},
  zoneRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#dddddd', paddingVertical: 8},
  zoneRowText: {fontSize: 14, color: '#000000', flexShrink: 1},
  zoneRowBtns: {flexDirection: 'row'},
  contentCard: {borderWidth: 1, borderColor: '#000000', borderRadius: 8, padding: 10, marginTop: 10},
  itemRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4},
  itemText: {fontSize: 13, color: '#000000', flexShrink: 1},
  miniBtn: {borderWidth: 1.5, borderColor: '#000000', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8, marginLeft: 5},
  miniBtnText: {fontSize: 13, color: '#000000', fontWeight: '600'},
  // wizard
  wizTitle: {fontSize: 22, fontWeight: '700', color: '#000000'},
  wizStepTag: {fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#666666', fontWeight: '700', marginTop: 10, marginBottom: 8},
  navBar: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderColor: '#dddddd'},
  navBtn: {borderWidth: 2, borderColor: '#000000', borderRadius: 9, paddingVertical: 10, paddingHorizontal: 18},
  navBtnPri: {backgroundColor: '#000000'},
  navBtnText: {fontSize: 16, fontWeight: '700', color: '#000000'},
  navBtnTextPri: {color: '#ffffff'},
  snapWrap: {flexDirection: 'row', flexWrap: 'wrap'},
  snap: {borderWidth: 2, borderColor: '#000000', borderRadius: 10, padding: 8, marginRight: 14, marginBottom: 14, alignItems: 'center'},
  snapOn: {borderWidth: 3},
  snapLabel: {fontSize: 14, fontWeight: '700', color: '#000000', textAlign: 'center', marginTop: 8},
  snapLabelOn: {textDecorationLine: 'underline'},
  // schematic mini page
  miniPage: {borderWidth: 1, borderColor: '#000000', borderRadius: 8, backgroundColor: '#ffffff', padding: 7, overflow: 'hidden'},
  miniPageTitle: {fontSize: 10, fontWeight: '700', color: '#000000', marginBottom: 5},
  // mini zone (labelled, schematic)
  mzBoxed: {borderWidth: 1.3, borderColor: '#000000', borderRadius: 5, overflow: 'hidden', marginBottom: 6},
  mzCap: {backgroundColor: '#000000', paddingVertical: 2, paddingHorizontal: 5},
  mzCapText: {color: '#ffffff', fontSize: 8, fontWeight: '700'},
  mzBody: {padding: 5},
  mzLedger: {marginBottom: 9},
  mzAiry: {marginBottom: 11},
  mzLabelText: {fontSize: 8, fontWeight: '700', color: '#000000', letterSpacing: 0.5, marginBottom: 4},
  mzLine: {height: 4, backgroundColor: '#cfcfcf', borderRadius: 2, marginBottom: 3},
  mzRule: {height: 1.4, backgroundColor: '#000000', marginBottom: 4},
});
