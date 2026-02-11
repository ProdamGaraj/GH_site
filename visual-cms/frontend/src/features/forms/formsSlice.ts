import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { formApi } from '@/shared/api/formApi'
import type {
  Form,
  CreateFormRequest,
  UpdateFormRequest,
  CreateDestinationRequest,
  UpdateDestinationRequest,
  FormSubmissionLog,
  SubmissionStats,
} from '@/shared/types/form'

// ─── State ───────────────────────────────────────────────────────

interface FormsState {
  items: Form[]
  currentForm: Form | null
  submissions: FormSubmissionLog[]
  submissionsTotal: number
  stats: SubmissionStats | null
  loading: boolean
  saving: boolean
  error: string | null
}

const initialState: FormsState = {
  items: [],
  currentForm: null,
  submissions: [],
  submissionsTotal: 0,
  stats: null,
  loading: false,
  saving: false,
  error: null,
}

// ─── Thunks ──────────────────────────────────────────────────────

export const fetchForms = createAsyncThunk(
  'forms/fetchAll',
  async (params?: { status?: string; pageId?: string; search?: string }) => {
    return await formApi.getAll(params)
  }
)

export const fetchFormById = createAsyncThunk(
  'forms/fetchById',
  async (id: string) => {
    return await formApi.getById(id)
  }
)

export const createForm = createAsyncThunk(
  'forms/create',
  async (data: CreateFormRequest) => {
    return await formApi.create(data)
  }
)

export const updateForm = createAsyncThunk(
  'forms/update',
  async ({ id, data }: { id: string; data: UpdateFormRequest }) => {
    return await formApi.update(id, data)
  }
)

export const deleteForm = createAsyncThunk(
  'forms/delete',
  async (id: string) => {
    await formApi.delete(id)
    return id
  }
)

export const duplicateForm = createAsyncThunk(
  'forms/duplicate',
  async (id: string) => {
    return await formApi.duplicate(id)
  }
)

export const createDestination = createAsyncThunk(
  'forms/createDestination',
  async ({ formId, data }: { formId: string; data: CreateDestinationRequest }) => {
    return await formApi.createDestination(formId, data)
  }
)

export const updateDestination = createAsyncThunk(
  'forms/updateDestination',
  async ({ formId, destId, data }: { formId: string; destId: string; data: UpdateDestinationRequest }) => {
    return await formApi.updateDestination(formId, destId, data)
  }
)

export const deleteDestination = createAsyncThunk(
  'forms/deleteDestination',
  async ({ formId, destId }: { formId: string; destId: string }) => {
    await formApi.deleteDestination(formId, destId)
    return destId
  }
)

export const fetchSubmissions = createAsyncThunk(
  'forms/fetchSubmissions',
  async ({ formId, params }: { formId: string; params?: { status?: string; limit?: number; offset?: number } }) => {
    return await formApi.getSubmissions(formId, params)
  }
)

export const fetchSubmissionStats = createAsyncThunk(
  'forms/fetchStats',
  async (formId: string) => {
    return await formApi.getSubmissionStats(formId)
  }
)

// ─── Slice ───────────────────────────────────────────────────────

const formsSlice = createSlice({
  name: 'forms',
  initialState,
  reducers: {
    clearCurrentForm(state) {
      state.currentForm = null
      state.submissions = []
      state.submissionsTotal = 0
      state.stats = null
    },
    clearError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    // Fetch all
    builder.addCase(fetchForms.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchForms.fulfilled, (state, action) => {
      state.loading = false
      state.items = action.payload
    })
    builder.addCase(fetchForms.rejected, (state, action) => {
      state.loading = false
      state.error = action.error.message || 'Failed to fetch forms'
    })

    // Fetch by ID
    builder.addCase(fetchFormById.pending, (state) => {
      state.loading = true
    })
    builder.addCase(fetchFormById.fulfilled, (state, action) => {
      state.loading = false
      state.currentForm = action.payload
    })
    builder.addCase(fetchFormById.rejected, (state, action) => {
      state.loading = false
      state.error = action.error.message || 'Failed to fetch form'
    })

    // Create
    builder.addCase(createForm.pending, (state) => {
      state.saving = true
    })
    builder.addCase(createForm.fulfilled, (state, action) => {
      state.saving = false
      state.items.unshift(action.payload)
      state.currentForm = action.payload
    })
    builder.addCase(createForm.rejected, (state, action) => {
      state.saving = false
      state.error = action.error.message || 'Failed to create form'
    })

    // Update
    builder.addCase(updateForm.pending, (state) => {
      state.saving = true
    })
    builder.addCase(updateForm.fulfilled, (state, action) => {
      state.saving = false
      const idx = state.items.findIndex((f) => f.id === action.payload.id)
      if (idx >= 0) state.items[idx] = action.payload
      if (state.currentForm?.id === action.payload.id) {
        state.currentForm = action.payload
      }
    })
    builder.addCase(updateForm.rejected, (state, action) => {
      state.saving = false
      state.error = action.error.message || 'Failed to update form'
    })

    // Delete
    builder.addCase(deleteForm.fulfilled, (state, action) => {
      state.items = state.items.filter((f) => f.id !== action.payload)
      if (state.currentForm?.id === action.payload) state.currentForm = null
    })

    // Duplicate
    builder.addCase(duplicateForm.fulfilled, (state, action) => {
      state.items.unshift(action.payload)
    })

    // Destinations
    builder.addCase(createDestination.fulfilled, (state, action) => {
      if (state.currentForm) {
        state.currentForm.destinations.push(action.payload)
      }
    })
    builder.addCase(updateDestination.fulfilled, (state, action) => {
      if (state.currentForm) {
        const idx = state.currentForm.destinations.findIndex((d) => d.id === action.payload.id)
        if (idx >= 0) state.currentForm.destinations[idx] = action.payload
      }
    })
    builder.addCase(deleteDestination.fulfilled, (state, action) => {
      if (state.currentForm) {
        state.currentForm.destinations = state.currentForm.destinations.filter(
          (d) => d.id !== action.payload
        )
      }
    })

    // Submissions
    builder.addCase(fetchSubmissions.fulfilled, (state, action) => {
      state.submissions = action.payload.items
      state.submissionsTotal = action.payload.total
    })
    builder.addCase(fetchSubmissionStats.fulfilled, (state, action) => {
      state.stats = action.payload
    })
  },
})

export const { clearCurrentForm, clearError } = formsSlice.actions
export default formsSlice.reducer
