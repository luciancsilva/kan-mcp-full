import type { Tool } from './workspace';
import {
  workspaceListTool,
  workspaceCreateTool,
  workspaceGetByIdTool,
  workspaceGetBySlugTool,
  workspaceUpdateTool,
  workspaceDeleteTool,
  workspaceSearchTool,
  workspaceCheckSlugAvailabilityTool,
} from './workspace';
import {
  boardListTool,
  boardCreateTool,
  boardGetByIdTool,
  boardGetBySlugTool,
  boardUpdateTool,
  boardDeleteTool,
  boardCheckSlugAvailabilityTool,
} from './board';
import {
  listCreateTool,
  listUpdateTool,
  listDeleteTool,
} from './list';
import {
  cardCreateTool,
  cardGetByIdTool,
  cardUpdateTool,
  cardDeleteTool,
  cardAddLabelTool,
  cardRemoveLabelTool,
  cardAddMemberTool,
  cardRemoveMemberTool,
  cardListActivitiesTool,
} from './card';
import {
  labelCreateTool,
  labelGetByIdTool,
  labelUpdateTool,
  labelDeleteTool,
} from './label';
import {
  checklistCreateTool,
  checklistUpdateTool,
  checklistDeleteTool,
  checklistAddItemTool,
  checklistUpdateItemTool,
  checklistDeleteItemTool,
} from './checklist';
import {
  commentAddTool,
  commentUpdateTool,
  commentDeleteTool,
} from './comment';
import { serverHealthTool } from './server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tools: any[] = [
  workspaceListTool,
  workspaceCreateTool,
  workspaceGetByIdTool,
  workspaceGetBySlugTool,
  workspaceUpdateTool,
  workspaceDeleteTool,
  workspaceSearchTool,
  workspaceCheckSlugAvailabilityTool,
  boardListTool,
  boardCreateTool,
  boardGetByIdTool,
  boardGetBySlugTool,
  boardUpdateTool,
  boardDeleteTool,
  boardCheckSlugAvailabilityTool,
  listCreateTool,
  listUpdateTool,
  listDeleteTool,
  cardCreateTool,
  cardGetByIdTool,
  cardUpdateTool,
  cardDeleteTool,
  cardAddLabelTool,
  cardRemoveLabelTool,
  cardAddMemberTool,
  cardRemoveMemberTool,
  cardListActivitiesTool,
  labelCreateTool,
  labelGetByIdTool,
  labelUpdateTool,
  labelDeleteTool,
  checklistCreateTool,
  checklistUpdateTool,
  checklistDeleteTool,
  checklistAddItemTool,
  checklistUpdateItemTool,
  checklistDeleteItemTool,
  commentAddTool,
  commentUpdateTool,
  commentDeleteTool,
  serverHealthTool,
];

export type { Tool } from './workspace';
