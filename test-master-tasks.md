# Master Tasks Button Functionality Test

## Test Checklist

### ✅ Edit Button (Pencil Icon)
- [ ] Click edit button opens the task edit modal
- [ ] Modal loads with existing task data
- [ ] All form fields are populated correctly (no null values)
- [ ] Saving changes updates the task in the database
- [ ] Changes are immediately visible in the table
- [ ] Modal closes after successful save
- [ ] Error handling works for failed saves

### ✅ Delete Button (Trash Can Icon)
- [ ] Click delete button shows confirmation dialog
- [ ] Confirmation dialog shows task title and warning
- [ ] Clicking "OK" deletes the task from database
- [ ] Task is immediately removed from the table
- [ ] Associated task instances are also deleted
- [ ] Loading spinner shows during deletion
- [ ] Error handling works for failed deletions

### ✅ Generate Instances Button (Calendar Icon)
- [ ] Click calendar button shows confirmation dialog
- [ ] Confirmation explains what will happen
- [ ] Clicking "OK" generates task instances
- [ ] Loading spinner shows during generation
- [ ] Success message shows number of instances generated
- [ ] Error handling works for failed generation
- [ ] Authentication is properly handled

### ✅ Status Change Dropdown
- [ ] Dropdown shows current status
- [ ] Changing status immediately updates the UI
- [ ] Status change is saved to database
- [ ] Error handling reverts UI on failure

### ✅ Generate All Instances Button (Header)
- [ ] Button is visible in the header
- [ ] Click shows confirmation for all tasks
- [ ] Generates instances for all active tasks
- [ ] Shows loading state during generation
- [ ] Success/error feedback is provided

## Test Scenarios

### Scenario 1: Edit Task
1. Navigate to Master Tasks page
2. Find any task in the table
3. Click the pencil (edit) icon
4. Verify modal opens with task data
5. Make a change (e.g., update title)
6. Click Save
7. Verify task is updated in the table
8. Verify modal closes

### Scenario 2: Delete Task
1. Navigate to Master Tasks page
2. Find any task in the table
3. Click the trash can (delete) icon
4. Verify confirmation dialog appears
5. Click OK to confirm
6. Verify task disappears from table
7. Verify success message appears

### Scenario 3: Generate Instances
1. Navigate to Master Tasks page
2. Find any task in the table
3. Click the calendar (generate instances) icon
4. Verify confirmation dialog appears
5. Click OK to confirm
6. Verify loading spinner appears
7. Verify success message with count appears

### Scenario 4: Status Change
1. Navigate to Master Tasks page
2. Find any task in the table
3. Click the status dropdown
4. Select a different status
5. Verify status changes immediately in UI
6. Verify success message appears

## Expected Results

All buttons should:
- ✅ Respond immediately when clicked
- ✅ Show appropriate loading states
- ✅ Update the UI immediately (optimistic updates)
- ✅ Sync changes with the database
- ✅ Show clear success/error messages
- ✅ Handle errors gracefully
- ✅ Maintain data consistency

## Database Verification

After each operation, verify in the database:
- Master tasks table reflects changes
- Task instances are created/deleted as expected
- Audit logs are created for changes
- No orphaned records remain